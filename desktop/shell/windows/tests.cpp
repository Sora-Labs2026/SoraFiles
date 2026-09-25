#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <shobjidl.h>
#include <shellapi.h>
#include <shlguid.h>
#include <cassert>
#include <filesystem>
#include <fstream>
#include <iostream>
#include "menu_protocol.hpp"

// Exercise the real DLL/process protocol with a fixture broker in an isolated
// temporary directory, independent of the developer's installed entitlement.
int fixture_broker(const wchar_t* request, const wchar_t* response) {
    std::ifstream input(request); std::string json((std::istreambuf_iterator<char>(input)), {});
    if (json.find("\"version\":1") == std::string::npos) return 1;
    std::ofstream output(response);
    output << (json.find("sample.png") != std::string::npos ? "image-test\tImage action\n" : "document-test\tDocument action\n");
    return output ? 0 : 1;
}
class FolderSite final : public IServiceProvider, public IFolderView {
    ULONG references = 1;
public:
    IShellItemArray* selection;
    explicit FolderSite(IShellItemArray* items) : selection(items) { selection->AddRef(); }
    ~FolderSite() { selection->Release(); }
    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID iid, void** out) override {
        if (!out) return E_POINTER; *out = nullptr;
        if (iid == IID_IUnknown || iid == IID_IServiceProvider) *out = static_cast<IServiceProvider*>(this);
        else if (iid == IID_IFolderView) *out = static_cast<IFolderView*>(this);
        else return E_NOINTERFACE;
        AddRef(); return S_OK;
    }
    ULONG STDMETHODCALLTYPE AddRef() override { return ++references; }
    ULONG STDMETHODCALLTYPE Release() override { ULONG n = --references; if (!n) delete this; return n; }
    HRESULT STDMETHODCALLTYPE QueryService(REFGUID service, REFIID iid, void** out) override {
        if (service == SID_SFolderView) return QueryInterface(iid, out);
        *out = nullptr; return E_NOINTERFACE;
    }
    HRESULT STDMETHODCALLTYPE Items(UINT flags, REFIID iid, void** out) override {
        assert(flags == SVGIO_SELECTION); return selection->QueryInterface(iid, out);
    }
    HRESULT STDMETHODCALLTYPE GetCurrentViewMode(UINT*) override { return E_NOTIMPL; }
    HRESULT STDMETHODCALLTYPE SetCurrentViewMode(UINT) override { return E_NOTIMPL; }
    HRESULT STDMETHODCALLTYPE GetFolder(REFIID, void**) override { return E_NOTIMPL; }
    HRESULT STDMETHODCALLTYPE Item(int, PITEMID_CHILD*) override { return E_NOTIMPL; }
    HRESULT STDMETHODCALLTYPE ItemCount(UINT, int*) override { return E_NOTIMPL; }
    HRESULT STDMETHODCALLTYPE GetSelectionMarkedItem(int*) override { return E_NOTIMPL; }
    HRESULT STDMETHODCALLTYPE GetFocusedItem(int*) override { return E_NOTIMPL; }
    HRESULT STDMETHODCALLTYPE GetItemPosition(PCUITEMID_CHILD, POINT*) override { return E_NOTIMPL; }
    HRESULT STDMETHODCALLTYPE GetSpacing(POINT*) override { return E_NOTIMPL; }
    HRESULT STDMETHODCALLTYPE GetDefaultSpacing(POINT*) override { return E_NOTIMPL; }
    HRESULT STDMETHODCALLTYPE GetAutoArrange() override { return E_NOTIMPL; }
    HRESULT STDMETHODCALLTYPE SelectItem(int, DWORD) override { return E_NOTIMPL; }
    HRESULT STDMETHODCALLTYPE SelectAndPositionItems(UINT, PCUITEMID_CHILD_ARRAY, POINT*, DWORD) override { return E_NOTIMPL; }
};
IShellItemArray* shell_selection(const std::filesystem::path& path) {
    std::ofstream(path) << "fixture";
    IShellItem* item{}; IShellItemArray* items{};
    assert(SUCCEEDED(SHCreateItemFromParsingName(path.c_str(), nullptr, IID_PPV_ARGS(&item))));
    assert(SUCCEEDED(SHCreateShellItemArrayFromShellItem(item, IID_PPV_ARGS(&items))));
    item->Release(); return items;
}
void expect_actions(IExplorerCommand* command, const wchar_t* expected) {
    IEnumExplorerCommand* children{}; assert(SUCCEEDED(command->EnumSubCommands(&children)));
    for (auto label : {expected, L"More options"}) {
        if (!label) continue;
        IExplorerCommand* child{}; ULONG fetched{}; PWSTR title{};
        assert(children->Next(1, &child, &fetched) == S_OK && fetched == 1);
        assert(SUCCEEDED(child->GetTitle(nullptr, &title)) && std::wstring(title) == label);
        CoTaskMemFree(title); child->Release();
    }
    IExplorerCommand* child{}; ULONG fetched{};
    assert(children->Next(1, &child, &fetched) == S_FALSE && fetched == 0); children->Release();
}
int wmain(int argc, wchar_t** argv) {
    using namespace sorafiles;
    if (argc == 4 && std::wstring(argv[1]) == L"--shell-menu") return fixture_broker(argv[2], argv[3]);
    assert(argc == 2);
    assert(SUCCEEDED(CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED)));
    for (auto value : {L"", L"plain", L"space value", L"a\\", L"C:\\ends with slash\\", L"literal\\\"quote", L"C:\\unicode-नमस्ते-日本語.pdf", L"& $(literal) ' x"}) {
        auto command = L"test.exe " + quote(value); int count{};
        auto parsed = CommandLineToArgvW(command.c_str(), &count);
        assert(parsed && count == 2 && std::wstring(parsed[1]) == value); LocalFree(parsed);
    }
    assert(!local_path(L"\\\\server\\share.pdf") && !local_path(L"relative.pdf"));
    assert(local_path(L"C:\\literal & $(stuff) ' 日本語.pdf"));
    std::string json;
    assert(request_json({L"C:\\नमस्ते.pdf", L"D:\\literal & $(stuff).png"}, json));
    assert(json.find("\"version\":1") != std::string::npos && json.find("C:\\\\") != std::string::npos);
    assert(request_json(std::vector<std::wstring>(256, L"C:\\日本語.pdf"), json));
    assert(!request_json(std::vector<std::wstring>(257, L"C:\\x.pdf"), json));
    assert(!request_json(std::vector<std::wstring>(256, L"C:\\" + std::wstring(300, L'a')), json));
    assert(!request_json({}, json));
    std::vector<Entry> entries;
    assert(parse_response("compress-pdf\tCompress PDF\nconvert-to-png\tConvert to PNG\n", entries) && entries.size() == 2);
    assert(parse_response(utf8(L"compress-pdf\t日本語\r\n"), entries) && entries.size() == 1);
    for (auto invalid : {"bad id\tBad\n", "unlock-pdf\tUnlock\n", "x\t\n", "x\tA\nx\tB\n", "x\tA\tB\n", "x\tA\n\n", "x\t\xff\n", "-x\tBad\n"}) assert(!parse_response(invalid, entries));
    assert(!parse_response("x\t" + std::string(101, 'a'), entries));
    std::string many; for (int i = 0; i < 33; ++i) many += "id-" + std::to_string(i) + "\tLabel\n";
    assert(!parse_response(many, entries));
    assert(!parse_response(utf8(L"id\tmisleading\u202etext"), entries));
    assert(!parse_response(std::string("id\tlabel\0hidden", 15), entries));
    GUID test_id{}; wchar_t test_guid[40]{}; assert(SUCCEEDED(CoCreateGuid(&test_id)));
    assert(StringFromGUID2(test_id, test_guid, 40));
    auto test_directory = std::filesystem::temp_directory_path() / (std::wstring(L"sorafiles-com-test-") + test_guid);
    assert(std::filesystem::create_directory(test_directory));
    wchar_t self[32768]{}; assert(GetModuleFileNameW(nullptr, self, 32768));
    auto fixture_exe = test_directory / L"sorafiles-desktop.exe";
    auto fixture_dll = test_directory / L"sorafiles-explorer.dll";
    assert(CopyFileW(self, fixture_exe.c_str(), TRUE));
    assert(CopyFileW(argv[1], fixture_dll.c_str(), TRUE));
    auto library = LoadLibraryW(fixture_dll.c_str()); assert(library);
    using GetFactory = HRESULT (WINAPI*)(REFCLSID, REFIID, void**);
    using CanUnload = HRESULT (WINAPI*)();
    auto get = reinterpret_cast<GetFactory>(GetProcAddress(library, "DllGetClassObject"));
    auto unload = reinterpret_cast<CanUnload>(GetProcAddress(library, "DllCanUnloadNow"));
    assert(get && unload && unload() == S_OK);
    const CLSID clsid = {0xf482b896,0x7d0b,0x4c12,{0x98,0x32,0x5b,0x6d,0x32,0x61,0x39,0xa7}};
    IClassFactory* factory{}; assert(SUCCEEDED(get(clsid, IID_PPV_ARGS(&factory))));
    assert(unload() == S_FALSE);
    IExplorerCommand* command{}; assert(SUCCEEDED(factory->CreateInstance(nullptr, IID_PPV_ARGS(&command))));
    PWSTR title{}; assert(SUCCEEDED(command->GetTitle(nullptr, &title)) && std::wstring(title) == L"Edit with SoraFiles"); CoTaskMemFree(title);
    EXPCMDFLAGS flags{}; assert(SUCCEEDED(command->GetFlags(&flags)) && flags == ECF_HASSUBCOMMANDS);
    // Null selection has no runnable action and does not launch a broker.
    EXPCMDSTATE state{}; assert(SUCCEEDED(command->GetState(nullptr, FALSE, &state)) && state == ECS_DISABLED);
    assert(SUCCEEDED(command->GetState(nullptr, TRUE, &state)) && state == ECS_DISABLED);
    IEnumExplorerCommand* children{}; assert(SUCCEEDED(command->EnumSubCommands(&children)));
    IExplorerCommand* child{}; ULONG fetched{}; assert(children->Next(1, &child, &fetched) == S_OK && fetched == 1);
    assert(SUCCEEDED(child->GetTitle(nullptr, &title)) && std::wstring(title) == L"More options"); CoTaskMemFree(title);
    assert(child->Invoke(nullptr, nullptr) == E_INVALIDARG); child->Release();
    assert(children->Next(1, &child, &fetched) == S_FALSE && fetched == 0);
    children->Reset(); IEnumExplorerCommand* clone{}; assert(SUCCEEDED(children->Clone(&clone)));
    assert(clone->Skip(1) == S_OK && clone->Skip(1) == S_FALSE); clone->Release();
    children->Release(); command->Release();
    auto png = shell_selection(test_directory / L"sample.png");
    auto pdf = shell_selection(test_directory / L"sample.pdf");
    assert(SUCCEEDED(factory->CreateInstance(nullptr, IID_PPV_ARGS(&command))));
    // Title -> enumeration, with no state callback at all.
    assert(SUCCEEDED(command->GetTitle(png, &title))); CoTaskMemFree(title);
    expect_actions(command, L"Image action");
    // A successful result is cached on this command only.
    assert(MoveFileW(fixture_exe.c_str(), (test_directory / L"broker-disabled.exe").c_str()));
    expect_actions(command, L"Image action");
    assert(MoveFileW((test_directory / L"broker-disabled.exe").c_str(), fixture_exe.c_str()));
    // A changed selection must invalidate the old action list.
    assert(SUCCEEDED(command->GetTitle(pdf, &title))); CoTaskMemFree(title);
    expect_actions(command, L"Document action"); command->Release();
    assert(SUCCEEDED(factory->CreateInstance(nullptr, IID_PPV_ARGS(&command))));
    // Fast GetState -> enumeration, without a slow/background callback.
    assert(SUCCEEDED(command->GetState(png, FALSE, &state)) && state == ECS_ENABLED);
    expect_actions(command, L"Image action"); command->Release();
    assert(SUCCEEDED(factory->CreateInstance(nullptr, IID_PPV_ARGS(&command))));
    assert(SUCCEEDED(command->GetTitle(png, &title))); CoTaskMemFree(title);
    assert(MoveFileW(fixture_exe.c_str(), (test_directory / L"broker-disabled.exe").c_str()));
    expect_actions(command, nullptr);
    assert(MoveFileW((test_directory / L"broker-disabled.exe").c_str(), fixture_exe.c_str()));
    // A failed broker start is throttled but is never permanently cached.
    Sleep(550); expect_actions(command, L"Image action"); command->Release();
    assert(SUCCEEDED(factory->CreateInstance(nullptr, IID_PPV_ARGS(&command))));
    IObjectWithSite* object_site{}; assert(SUCCEEDED(command->QueryInterface(IID_PPV_ARGS(&object_site))));
    auto site = new FolderSite(png);
    assert(SUCCEEDED(object_site->SetSite(static_cast<IServiceProvider*>(site)))); site->Release();
    IServiceProvider* read_site{}; assert(SUCCEEDED(object_site->GetSite(IID_PPV_ARGS(&read_site)))); read_site->Release();
    // Site -> enumeration, without title or state receiving any selection.
    expect_actions(command, L"Image action");
    site->selection->Release(); site->selection = pdf; pdf->AddRef();
    expect_actions(command, L"Document action");
    assert(SUCCEEDED(object_site->SetSite(nullptr)));
    assert(SUCCEEDED(command->GetState(nullptr, FALSE, &state)) && state == ECS_DISABLED);
    object_site->Release(); command->Release(); png->Release(); pdf->Release();
    factory->Release(); assert(unload() == S_OK);
    FreeLibrary(library); std::filesystem::remove_all(test_directory); CoUninitialize();
    std::cout << "PASS protocol bounds, literal arguments, COM lifecycle, title-only/fast-state/site-only enumeration, selection changes, cached results and failed-start retry\n";
    return 0;
}
