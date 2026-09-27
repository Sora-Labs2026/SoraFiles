#pragma once
#include <string>
#include <algorithm>
#include <cctype>

namespace sorafiles {
// Bounded display-only preference. Never use a preference as an executable,
// command argument, path, or action identifier.
inline std::string supported_language(std::string value) {
    std::transform(value.begin(),value.end(),value.begin(),[](unsigned char c){return static_cast<char>(std::tolower(c));});
    std::replace(value.begin(),value.end(),'_','-');
    if(value=="zh-tw" || value=="zh-hk" || value=="zh-mo" || value.rfind("zh-hant",0)==0)return "zh-tw";
    if(value=="zh" || value.rfind("zh-",0)==0)return "zh-cn";
    const auto end=value.find_first_of("-.@"); const auto base=value.substr(0,end);
    for(const auto* code:{"en","ja","ko","es","fr","de","pt","hi","ar","ru","id","it","nl","tr","vi","th","pl"})if(base==code)return base;
    return "en";
}
inline std::string saved_language(const std::string& json) {
    if(json.size()>16384)return "system";
    const auto key=json.find("\"language\""); if(key==std::string::npos)return "system";
    auto i=key+10;
    const auto skip=[&](){while(i<json.size() && (json[i]==' '||json[i]=='\t'||json[i]=='\r'||json[i]=='\n'))++i;};
    skip(); if(i>=json.size()||json[i++]!=':')return "system";
    skip(); if(i>=json.size()||json[i++]!='\"')return "system";
    const auto end=json.find('"',i); if(end==std::string::npos||end-i>6)return "system";
    const auto value=json.substr(i,end-i);
    if(value=="system")return value;
    for(const auto* code:{"en","ja","ko","es","fr","de","pt","zh-cn","zh-tw","hi","ar","ru","id","it","nl","tr","vi","th","pl"})if(value==code)return value;
    return "system";
}
inline const wchar_t* edit_label(const std::string& language) {
    if(language=="ja")return L"SoraFilesで編集";
    if(language=="ko")return L"SoraFiles로 편집";
    if(language=="es")return L"Editar con SoraFiles";
    if(language=="fr")return L"Modifier avec SoraFiles";
    if(language=="de")return L"Mit SoraFiles bearbeiten";
    if(language=="pt")return L"Editar com SoraFiles";
    if(language=="zh-cn")return L"使用 SoraFiles 编辑";
    if(language=="zh-tw")return L"使用 SoraFiles 編輯";
    if(language=="hi")return L"SoraFiles से संपादित करें";
    if(language=="ar")return L"تحرير باستخدام SoraFiles";
    if(language=="ru")return L"Редактировать в SoraFiles";
    if(language=="id")return L"Edit dengan SoraFiles";
    if(language=="it")return L"Modifica con SoraFiles";
    if(language=="nl")return L"Bewerken met SoraFiles";
    if(language=="tr")return L"SoraFiles ile düzenle";
    if(language=="vi")return L"Chỉnh sửa bằng SoraFiles";
    if(language=="th")return L"แก้ไขด้วย SoraFiles";
    if(language=="pl")return L"Edytuj w SoraFiles";
    return L"Edit with SoraFiles";
}
}
