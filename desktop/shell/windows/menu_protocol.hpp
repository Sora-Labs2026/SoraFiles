#pragma once
#include <windows.h>
#include <string>
#include <vector>
#include <set>

namespace sorafiles {
struct Entry { std::wstring id, label; };
inline std::string utf8(const std::wstring& value) {
    int n = WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), nullptr, 0, nullptr, nullptr);
    if (!n) return {};
    std::string out(n, '\0');
    WideCharToMultiByte(CP_UTF8, WC_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), out.data(), n, nullptr, nullptr);
    return out;
}
inline std::wstring wide(const std::string& value) {
    int n = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), nullptr, 0);
    if (!n) return {};
    std::wstring out(n, L'\0');
    MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(), static_cast<int>(value.size()), out.data(), n);
    return out;
}
inline bool local_path(const std::wstring& path) {
    return path.size() >= 3 && path.size() < 32768 &&
        ((path[0] >= L'A' && path[0] <= L'Z') || (path[0] >= L'a' && path[0] <= L'z')) &&
        path[1] == L':' && (path[2] == L'\\' || path[2] == L'/') &&
        path.find_first_of(L"\r\n\t\"") == std::wstring::npos && path.find(L'\0') == std::wstring::npos;
}
inline std::wstring quote(const std::wstring& value) {
    std::wstring result = L"\""; size_t slashes = 0;
    for (wchar_t c : value) {
        if (c == L'\\') { ++slashes; continue; }
        result.append(slashes * (c == L'"' ? 2 : 1), L'\\'); slashes = 0;
        if (c == L'"') result += L'\\';
        result += c;
    }
    result.append(slashes * 2, L'\\'); return result + L'"';
}
inline bool action_id(const std::wstring& id) {
    if (id.empty() || id.size() > 64 || id.front() == L'-' || id.back() == L'-') return false;
    if (id == L"unlock-pdf" || id == L"decrypt-pdf" || id == L"unprotect-pdf" || id == L"remove-pdf-password") return false;
    bool hyphen = false;
    for (auto c : id) {
        if (!((c >= L'a' && c <= L'z') || (c >= L'0' && c <= L'9') || c == L'-')) return false;
        if (c == L'-' && hyphen) return false;
        hyphen = c == L'-';
    }
    return true;
}
inline bool request_json(const std::vector<std::wstring>& files, std::string& out) {
    if (files.empty() || files.size() > 256) return false;
    out = "{\"version\":1,\"files\":[";
    for (size_t i = 0; i < files.size(); ++i) {
        if (!local_path(files[i])) return false;
        auto encoded = utf8(files[i]); if (encoded.empty()) return false;
        if (i) out += ',';
        out += '"';
        for (unsigned char c : encoded) {
            if (c < 32) return false;
            if (c == '\\' || c == '"') out += '\\';
            out += static_cast<char>(c);
        }
        out += '"'; if (out.size() > 65533) return false;
    }
    out += "]}"; return out.size() <= 65536;
}
inline bool parse_response(const std::string& bytes, std::vector<Entry>& entries) {
    entries.clear();
    if (bytes.empty() || bytes.size() > 16384) return false;
    auto data = wide(bytes); if (data.empty() || data.find(L'\0') != std::wstring::npos) return false;
    std::set<std::wstring> ids; std::vector<Entry> parsed;
    size_t pos = 0;
    while (pos < data.size()) {
        auto end = data.find(L'\n', pos); if (end == std::wstring::npos) end = data.size();
        auto line = data.substr(pos, end - pos); pos = end + 1;
        if (!line.empty() && line.back() == L'\r') line.pop_back();
        auto tab = line.find(L'\t'); if (tab == std::wstring::npos) return false;
        Entry entry{line.substr(0, tab), line.substr(tab + 1)};
        if (!action_id(entry.id) || !ids.insert(entry.id).second || entry.label.empty()) return false;
        size_t characters = 0;
        for (wchar_t c : entry.label) {
            if (c < 32 || c == 127 || (c >= 0x202a && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069)) return false;
            if (c < 0xdc00 || c > 0xdfff) ++characters;
        }
        if (characters > 100 || parsed.size() == 32) return false;
        parsed.push_back(std::move(entry));
    }
    entries = std::move(parsed); return !entries.empty();
}
}
