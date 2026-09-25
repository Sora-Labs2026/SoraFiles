// Explorer hosts only this small command adapter. Classification and entitlement
// stay in the bounded out-of-process application broker; no engines load here.
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <shobjidl.h>
#include <shlwapi.h>
#include <shlguid.h>
#include <atomic>
#include <algorithm>
#include <mutex>
#include <new>
#include "menu_protocol.hpp"

namespace {
using sorafiles::Entry;
const CLSID CLSID_SoraFiles = {0xf482b896,0x7d0b,0x4c12,{0x98,0x32,0x5b,0x6d,0x32,0x61,0x39,0xa7}};
HMODULE module_handle{};
std::atomic<long> objects{0};
struct Handle {
    HANDLE value{nullptr};
    explicit Handle(HANDLE h = nullptr) : value(h) {}
    ~Handle() { if (value && value != INVALID_HANDLE_VALUE) CloseHandle(value); }
    Handle(const Handle&) = delete; Handle& operator=(const Handle&) = delete;
    bool valid() const { return value && value != INVALID_HANDLE_VALUE; }
};
std::wstring application() {
    std::wstring path(32768, L'\0');
    DWORD count = GetModuleFileNameW(module_handle, path.data(), static_cast<DWORD>(path.size()));
    if (!count || count >= path.size()) return {};
    path.resize(count); auto slash = path.find_last_of(L"\\/");
    return slash == std::wstring::npos ? L"" : path.substr(0, slash + 1) + L"sorafiles-desktop.exe";
}
bool selected(IShellItemArray* items, std::vector<std::wstring>& files) {
    files.clear(); DWORD count{};
    if (!items || FAILED(items->GetCount(&count)) || !count || count > 256) return false;
    for (DWORD i = 0; i < count; ++i) {
        IShellItem* item{}; PWSTR path{};
        if (FAILED(items->GetItemAt(i, &item))) { files.clear(); return false; }
        HRESULT hr = item->GetDisplayName(SIGDN_FILESYSPATH, &path); item->Release();
        if (FAILED(hr) || !path) { if (path) CoTaskMemFree(path); files.clear(); return false; }
        std::wstring value(path); CoTaskMemFree(path);
        if (!sorafiles::local_path(value)) { files.clear(); return false; }
        files.push_back(std::move(value));
    }
    return true;
}
struct TempRequest {
    std::wstring directory, request, response;
    ~TempRequest() {
        if (!request.empty()) DeleteFileW(request.c_str());
        if (!response.empty()) DeleteFileW(response.c_str());
        if (!directory.empty()) RemoveDirectoryW(directory.c_str());
    }
    bool create(const std::string& json) {
        wchar_t temp[32768]{}; DWORD count = GetTempPathW(32768, temp);
        if (!count || count >= 32768) return false;
        GUID id{}; wchar_t guid[40]{};
        if (FAILED(CoCreateGuid(&id)) || !StringFromGUID2(id, guid, 40)) return false;
        // UUID without braces is shared with the broker's exact directory rule.
        auto candidate = std::wstring(temp) + L"sorafiles-shell-" + std::wstring(guid + 1, 36);
        if (!CreateDirectoryW(candidate.c_str(), nullptr)) return false;
        directory = candidate; request = directory + L"\\request.json"; response = directory + L"\\response.tsv";
        Handle file(CreateFileW(request.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_NEW, FILE_ATTRIBUTE_NORMAL, nullptr));
        DWORD written{};
        return file.valid() && WriteFile(file.value, json.data(), static_cast<DWORD>(json.size()), &written, nullptr) && written == json.size();
    }
};
bool broker(const std::vector<std::wstring>& files, std::vector<Entry>& entries) {
    std::string json; if (!sorafiles::request_json(files, json)) return false;
    TempRequest temp; if (!temp.create(json)) return false;
    auto exe = application(); if (exe.empty()) return false;
    auto command = sorafiles::quote(exe) + L" --shell-menu " + sorafiles::quote(temp.request) + L" " + sorafiles::quote(temp.response);
    Handle job(CreateJobObjectW(nullptr, nullptr)); if (!job.valid()) return false;
    JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits{}; limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
    if (!SetInformationJobObject(job.value, JobObjectExtendedLimitInformation, &limits, sizeof(limits))) return false;
    STARTUPINFOW startup{}; startup.cb = sizeof(startup); PROCESS_INFORMATION info{};
    if (!CreateProcessW(exe.c_str(), command.data(), nullptr, nullptr, FALSE, CREATE_NO_WINDOW | CREATE_SUSPENDED, nullptr, nullptr, &startup, &info)) return false;
    Handle process(info.hProcess), thread(info.hThread);
    if (!AssignProcessToJobObject(job.value, process.value)) { TerminateProcess(process.value, 1); WaitForSingleObject(process.value, 100); return false; }
    // Explorer can ask for the menu on a cold install.  Starting the bundled
    // Node host and loading the local license state can take a few seconds;
    // the old 1.4s cutoff made a transient startup delay look like an empty
    // menu and the failed result was then cached by the command instance.
    if (ResumeThread(thread.value) == static_cast<DWORD>(-1) || WaitForSingleObject(process.value, 10000) != WAIT_OBJECT_0) {
        TerminateJobObject(job.value, 1); WaitForSingleObject(process.value, 100); return false;
    }
    DWORD code{}; if (!GetExitCodeProcess(process.value, &code) || code != 0) return false;
    Handle result(CreateFileW(temp.response.c_str(), GENERIC_READ, FILE_SHARE_READ, nullptr, OPEN_EXISTING, FILE_FLAG_OPEN_REPARSE_POINT, nullptr));
    BY_HANDLE_FILE_INFORMATION attributes{}; LARGE_INTEGER size{};
    if (!result.valid() || !GetFileInformationByHandle(result.value, &attributes) ||
        (attributes.dwFileAttributes & (FILE_ATTRIBUTE_REPARSE_POINT | FILE_ATTRIBUTE_DIRECTORY)) ||
        !GetFileSizeEx(result.value, &size) || size.QuadPart <= 0 || size.QuadPart > 16384) return false;
    std::string bytes(static_cast<size_t>(size.QuadPart), '\0'); DWORD read{};
    return ReadFile(result.value, bytes.data(), static_cast<DWORD>(bytes.size()), &read, nullptr) &&
        read == bytes.size() && sorafiles::parse_response(bytes, entries);
}
HRESULT launch(const std::wstring& action, const std::vector<std::wstring>& files) {
    if (files.empty() || files.size() > 256 || (!action.empty() && !sorafiles::action_id(action))) return E_INVALIDARG;
    auto exe = application(); if (exe.empty()) return E_FAIL;
    auto command = sorafiles::quote(exe) + (action.empty() ? L" --edit --" : L" --action " + sorafiles::quote(action) + L" --");
    for (auto& path : files) { if (!sorafiles::local_path(path)) return E_INVALIDARG; command += L" " + sorafiles::quote(path); }
    if (command.size() >= 32767) return HRESULT_FROM_WIN32(ERROR_BUFFER_OVERFLOW);
    STARTUPINFOW startup{}; startup.cb = sizeof(startup); PROCESS_INFORMATION info{};
    if (!CreateProcessW(exe.c_str(), command.data(), nullptr, nullptr, FALSE, 0, nullptr, nullptr, &startup, &info)) return HRESULT_FROM_WIN32(GetLastError());
    CloseHandle(info.hThread); CloseHandle(info.hProcess); return S_OK;
}
class Command;
class Enumerator final : public IEnumExplorerCommand {
    std::atomic<ULONG> references{1}; std::vector<IExplorerCommand*> children; size_t position{};
public:
    explicit Enumerator(std::vector<IExplorerCommand*> values) : children(std::move(values)) { ++objects; }
    ~Enumerator() { for (auto child : children) child->Release(); --objects; }
    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID iid, void** out) override {
        if (!out) return E_POINTER; *out = nullptr;
        if (iid == IID_IUnknown || iid == IID_IEnumExplorerCommand) { *out = static_cast<IEnumExplorerCommand*>(this); AddRef(); return S_OK; } return E_NOINTERFACE;
    }
    ULONG STDMETHODCALLTYPE AddRef() override { return ++references; }
    ULONG STDMETHODCALLTYPE Release() override { ULONG n = --references; if (!n) delete this; return n; }
    HRESULT STDMETHODCALLTYPE Next(ULONG count, IExplorerCommand** out, ULONG* fetched) override {
        if (!out || (!fetched && count != 1)) return E_POINTER;
        ULONG n = 0; while (n < count && position < children.size()) { out[n] = children[position++]; out[n++]->AddRef(); }
        if (fetched) *fetched = n; return n == count ? S_OK : S_FALSE;
    }
    HRESULT STDMETHODCALLTYPE Skip(ULONG count) override { auto n = (std::min)(static_cast<size_t>(count), children.size() - position); position += n; return n == count ? S_OK : S_FALSE; }
    HRESULT STDMETHODCALLTYPE Reset() override { position = 0; return S_OK; }
    HRESULT STDMETHODCALLTYPE Clone(IEnumExplorerCommand** out) override {
        if (!out) return E_POINTER; *out = nullptr;
        auto copy = children; for (auto child : copy) child->AddRef();
        auto next = new (std::nothrow) Enumerator(std::move(copy)); if (!next) { for (auto child : children) child->Release(); return E_OUTOFMEMORY; }
        next->position = position; *out = next; return S_OK;
    }
};
class Command final : public IExplorerCommand, public IObjectWithSite {
    std::atomic<ULONG> references{1}; bool root; Entry entry; std::mutex mutex;
    std::mutex broker_mutex;
    IUnknown* site = nullptr;
    std::vector<std::wstring> files; std::vector<Entry> entries; bool resolved = false;
    ULONGLONG failed_at = 0;
    void capture(IShellItemArray* items) {
        if (!root || !items) return;
        std::vector<std::wstring> next; selected(items, next);
        std::lock_guard<std::mutex> lock(mutex);
        if (files != next) { files = std::move(next); entries.clear(); resolved = false; failed_at = 0; }
    }
    void capture_site() {
        IUnknown* current{};
        { std::lock_guard<std::mutex> lock(mutex); current = site; if (current) current->AddRef(); }
        if (!current) return;
        IServiceProvider* services{}; IFolderView* view{};
        if (SUCCEEDED(current->QueryInterface(IID_PPV_ARGS(&services)))) {
            services->QueryService(SID_SFolderView, IID_PPV_ARGS(&view)); services->Release();
        }
        current->Release();
        if (!view) return;
        IShellItemArray* items{};
        HRESULT hr = view->Items(SVGIO_SELECTION, IID_PPV_ARGS(&items)); view->Release();
        if (SUCCEEDED(hr) && items) { capture(items); items->Release(); }
    }
    void resolve() {
        // Only one broker call per command may run at a time. Selection changes
        // invalidate results; failed starts may retry after a short cooldown.
        std::lock_guard<std::mutex> broker_lock(broker_mutex);
        std::vector<std::wstring> next;
        {
            std::lock_guard<std::mutex> lock(mutex);
            if (files.empty() || resolved || (failed_at && GetTickCount64() - failed_at < 500)) return;
            next = files;
        }
        std::vector<Entry> result; bool success = broker(next, result);
        std::lock_guard<std::mutex> lock(mutex);
        if (files == next) {
            entries = std::move(result); resolved = success;
            failed_at = success ? 0 : GetTickCount64();
        }
    }
public:
    explicit Command(bool is_root = true, Entry item = {}, std::vector<std::wstring> paths = {}) : root(is_root), entry(std::move(item)), files(std::move(paths)) { ++objects; }
    ~Command() { if (site) site->Release(); --objects; }
    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID iid, void** out) override {
        if (!out) return E_POINTER; *out = nullptr;
        if (iid == IID_IUnknown || iid == IID_IExplorerCommand) *out = static_cast<IExplorerCommand*>(this);
        else if (iid == IID_IObjectWithSite) *out = static_cast<IObjectWithSite*>(this);
        else return E_NOINTERFACE;
        AddRef(); return S_OK;
    }
    ULONG STDMETHODCALLTYPE AddRef() override { return ++references; }
    ULONG STDMETHODCALLTYPE Release() override { ULONG n = --references; if (!n) delete this; return n; }
    HRESULT STDMETHODCALLTYPE SetSite(IUnknown* next) override {
        if (next) next->AddRef();
        IUnknown* previous{};
        { std::lock_guard<std::mutex> lock(mutex); previous = site; site = next;
          if (root) { files.clear(); entries.clear(); resolved = false; failed_at = 0; } }
        if (previous) previous->Release(); return S_OK;
    }
    HRESULT STDMETHODCALLTYPE GetSite(REFIID iid, void** out) override {
        if (!out) return E_POINTER; *out = nullptr;
        IUnknown* current{};
        { std::lock_guard<std::mutex> lock(mutex); current = site; if (current) current->AddRef(); }
        if (!current) return E_FAIL;
        HRESULT hr = current->QueryInterface(iid, out); current->Release(); return hr;
    }
    HRESULT STDMETHODCALLTYPE GetTitle(IShellItemArray* items, LPWSTR* out) override {
        if (!out) return E_POINTER; *out = nullptr;
        try { capture(items); return SHStrDupW(root ? L"Edit with SoraFiles" : entry.label.c_str(), out); }
        catch (...) { return E_FAIL; }
    }
    HRESULT STDMETHODCALLTYPE GetIcon(IShellItemArray*, LPWSTR* out) override { if (!out) return E_POINTER; *out = nullptr; return E_NOTIMPL; }
    HRESULT STDMETHODCALLTYPE GetToolTip(IShellItemArray*, LPWSTR* out) override { if (!out) return E_POINTER; *out = nullptr; return E_NOTIMPL; }
    HRESULT STDMETHODCALLTYPE GetCanonicalName(GUID* out) override { if (!out) return E_POINTER; *out = root ? CLSID_SoraFiles : GUID_NULL; return S_OK; }
    HRESULT STDMETHODCALLTYPE GetState(IShellItemArray* items, BOOL slow, EXPCMDSTATE* state) override {
        if (!state) return E_POINTER; *state = ECS_ENABLED;
        if (!root) return S_OK;
        try {
            if (items) capture(items); else capture_site();
            if (slow) resolve();
            std::lock_guard<std::mutex> lock(mutex);
            if (files.empty()) *state = ECS_DISABLED;
            return S_OK;
        } catch (...) { return E_FAIL; }
    }
    HRESULT STDMETHODCALLTYPE Invoke(IShellItemArray* items, IBindCtx*) override {
        try { std::vector<std::wstring> paths; if (!selected(items, paths)) { std::lock_guard<std::mutex> lock(mutex); paths = files; } return launch(root ? L"" : entry.id, paths); }
        catch (...) { return E_FAIL; }
    }
    HRESULT STDMETHODCALLTYPE GetFlags(EXPCMDFLAGS* out) override { if (!out) return E_POINTER; *out = root ? ECF_HASSUBCOMMANDS : ECF_DEFAULT; return S_OK; }
    HRESULT STDMETHODCALLTYPE EnumSubCommands(IEnumExplorerCommand** out) override {
        if (!out) return E_POINTER; *out = nullptr; if (!root) return E_NOTIMPL;
        std::vector<IExplorerCommand*> children;
        try {
            // Explorer may enumerate without calling the slow GetState path.
            // GetTitle supplies selection on some hosts; the site supplies it
            // on others. Resolve here so callback order cannot empty the menu.
            capture_site(); resolve();
            std::lock_guard<std::mutex> lock(mutex);
            for (auto& item : entries) if (item.id != L"open") children.push_back(new Command(false, item, files));
            children.push_back(new Command(false, {L"", L"More options"}, files));
            *out = new Enumerator(std::move(children)); return S_OK;
        } catch (...) { for (auto child : children) child->Release(); return E_OUTOFMEMORY; }
    }
};
class Factory final : public IClassFactory {
    std::atomic<ULONG> references{1};
public:
    Factory() { ++objects; } ~Factory() { --objects; }
    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID iid, void** out) override {
        if (!out) return E_POINTER; *out = nullptr;
        if (iid == IID_IUnknown || iid == IID_IClassFactory) { *out = static_cast<IClassFactory*>(this); AddRef(); return S_OK; } return E_NOINTERFACE;
    }
    ULONG STDMETHODCALLTYPE AddRef() override { return ++references; }
    ULONG STDMETHODCALLTYPE Release() override { ULONG n = --references; if (!n) delete this; return n; }
    HRESULT STDMETHODCALLTYPE CreateInstance(IUnknown* outer, REFIID iid, void** out) override {
        if (!out) return E_POINTER; *out = nullptr; if (outer) return CLASS_E_NOAGGREGATION;
        auto command = new (std::nothrow) Command; if (!command) return E_OUTOFMEMORY;
        HRESULT hr = command->QueryInterface(iid, out); command->Release(); return hr;
    }
    HRESULT STDMETHODCALLTYPE LockServer(BOOL lock) override { if (lock) ++objects; else --objects; return S_OK; }
};
}
BOOL WINAPI DllMain(HINSTANCE instance, DWORD reason, LPVOID) {
    if (reason == DLL_PROCESS_ATTACH) { module_handle = instance; DisableThreadLibraryCalls(instance); } return TRUE;
}
extern "C" HRESULT __stdcall DllGetClassObject(REFCLSID clsid, REFIID iid, void** out) {
    if (!out) return E_POINTER; *out = nullptr; if (clsid != CLSID_SoraFiles) return CLASS_E_CLASSNOTAVAILABLE;
    auto factory = new (std::nothrow) Factory; if (!factory) return E_OUTOFMEMORY;
    HRESULT hr = factory->QueryInterface(iid, out); factory->Release(); return hr;
}
extern "C" HRESULT __stdcall DllCanUnloadNow() { return objects == 0 ? S_OK : S_FALSE; }
