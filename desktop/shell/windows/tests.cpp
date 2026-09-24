#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <shobjidl.h>
#include <shellapi.h>
#include <cassert>
#include <iostream>
#include "menu_protocol.hpp"

int wmain(int argc, wchar_t** argv) {
    using namespace sorafiles;
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
    auto library = LoadLibraryW(argv[1]); assert(library);
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
    EXPCMDSTATE state{}; assert(command->GetState(nullptr, FALSE, &state) == E_PENDING);
    assert(SUCCEEDED(command->GetState(nullptr, TRUE, &state)) && state == ECS_DISABLED);
    IEnumExplorerCommand* children{}; assert(SUCCEEDED(command->EnumSubCommands(&children)));
    IExplorerCommand* child{}; ULONG fetched{}; assert(children->Next(1, &child, &fetched) == S_OK && fetched == 1);
    assert(SUCCEEDED(child->GetTitle(nullptr, &title)) && std::wstring(title) == L"More options"); CoTaskMemFree(title);
    assert(child->Invoke(nullptr, nullptr) == E_INVALIDARG); child->Release();
    assert(children->Next(1, &child, &fetched) == S_FALSE && fetched == 0);
    children->Reset(); IEnumExplorerCommand* clone{}; assert(SUCCEEDED(children->Clone(&clone)));
    assert(clone->Skip(1) == S_OK && clone->Skip(1) == S_FALSE); clone->Release();
    children->Release(); command->Release(); factory->Release(); assert(unload() == S_OK);
    FreeLibrary(library); CoUninitialize();
    std::cout << "PASS protocol bounds, literal argument round trips, COM lifecycle, async state and fallback menu\n";
    return 0;
}
