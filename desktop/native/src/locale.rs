//! UI language selection only; never uses regional number/date formatting.
pub const SUPPORTED: [&str; 19] = ["en","ja","ko","es","fr","de","pt","zh-cn","zh-tw","hi","ar","ru","id","it","nl","tr","vi","th","pl"];

pub fn valid_preference(value: &str) -> bool { value == "system" || SUPPORTED.contains(&value) }

pub fn dialog_text<'a>(locale:&str,key:&'a str)->&'a str {
    static MESSAGES:std::sync::OnceLock<serde_json::Value>=std::sync::OnceLock::new();
    MESSAGES.get_or_init(||serde_json::from_str(include_str!("../../shared/locales/native.json")).expect("validated native language catalog"))
        .get(locale).and_then(|messages|messages.get(key)).and_then(serde_json::Value::as_str).unwrap_or(key)
}

pub fn normalize(value: &str) -> String {
    let tag=value.trim().split(['.', '@']).next().unwrap_or("").replace('_', "-").to_ascii_lowercase();
    let parts:Vec<_>=tag.split('-').collect();
    let base=parts.first().copied().unwrap_or("");
    if base=="zh" {
        if parts.contains(&"hant") || parts.iter().any(|part|matches!(*part,"tw"|"hk"|"mo")){return "zh-tw".into();}
        return "zh-cn".into();
    }
    if SUPPORTED.contains(&base){base.into()}else{"en".into()}
}

pub fn effective_locale(preference: &str) -> String {
    if preference=="system" { system_locale() }
    else if SUPPORTED.contains(&preference) { preference.into() }
    else { "en".into() }
}

#[cfg(windows)]
fn system_locale() -> String {
    #[link(name="kernel32")]
    extern "system" { fn GetUserPreferredUILanguages(flags:u32,count:*mut u32,buffer:*mut u16,size:*mut u32)->i32; }
    // MUI_LANGUAGE_NAME queries display-language preferences, unlike GetUserDefaultLocaleName.
    let(mut count,mut size)=(0u32,0u32);
    unsafe {
        if GetUserPreferredUILanguages(8,&mut count,std::ptr::null_mut(),&mut size)==0 || size==0 || size>32768{return "en".into();}
        let mut buffer=vec![0u16;size as usize];
        if GetUserPreferredUILanguages(8,&mut count,buffer.as_mut_ptr(),&mut size)==0{return "en".into();}
        normalize(&String::from_utf16_lossy(buffer.split(|item|*item==0).next().unwrap_or(&[])))
    }
}

#[cfg(target_os="macos")]
fn system_locale() -> String {
    use std::ffi::{c_char,c_void};
    #[link(name="CoreFoundation",kind="framework")]
    extern "C" {
        fn CFLocaleCopyPreferredLanguages()->*const c_void;
        fn CFArrayGetCount(array:*const c_void)->isize;
        fn CFArrayGetValueAtIndex(array:*const c_void,index:isize)->*const c_void;
        fn CFStringGetCString(string:*const c_void,buffer:*mut c_char,size:isize,encoding:u32)->u8;
        fn CFRelease(value:*const c_void);
    }
    unsafe {
        let array=CFLocaleCopyPreferredLanguages();
        if array.is_null(){return "en".into();}
        let mut buffer=[0u8;256];
        let ok=CFArrayGetCount(array)>0 && CFStringGetCString(CFArrayGetValueAtIndex(array,0),buffer.as_mut_ptr().cast(),buffer.len() as isize,0x08000100)!=0;
        CFRelease(array);
        if !ok{return "en".into();}
        let end=buffer.iter().position(|byte|*byte==0).unwrap_or(buffer.len());
        normalize(std::str::from_utf8(&buffer[..end]).unwrap_or("en"))
    }
}

// GNU LANGUAGE is a message-language preference list, but POSIX C locale
// deliberately disables translations even when LANGUAGE was inherited.
#[cfg(any(target_os="linux",test))]
fn linux_locale(language:Option<&str>,all:Option<&str>,messages:Option<&str>,lang:Option<&str>)->String {
    fn usable(value:Option<&str>)->Option<&str>{value.filter(|value|!value.trim().is_empty())}
    let category=usable(all).or_else(||usable(messages)).or_else(||usable(lang)).unwrap_or("C");
    if matches!(category.to_ascii_lowercase().as_str(),"c"|"posix"|"c.utf-8"|"c.utf8"){return "en".into();}
    normalize(usable(language).and_then(|value|value.split(':').find(|part|!part.is_empty())).unwrap_or(category))
}

#[cfg(target_os="linux")]
fn system_locale()->String {
    let language=std::env::var("LANGUAGE").ok();let all=std::env::var("LC_ALL").ok();
    let messages=std::env::var("LC_MESSAGES").ok();let lang=std::env::var("LANG").ok();
    linux_locale(language.as_deref(),all.as_deref(),messages.as_deref(),lang.as_deref())
}
#[cfg(not(any(windows,target_os="macos",target_os="linux")))]
fn system_locale()->String {"en".into()}

pub fn text(locale:&str,key:&str)->&'static str {
    let labels=match locale {
        "ja"=>["SoraFilesで編集","SoraFilesを開く","SoraFilesを終了"],
        "ko"=>["SoraFiles로 편집","SoraFiles 열기","SoraFiles 종료"],
        "es"=>["Editar con SoraFiles","Abrir SoraFiles","Salir de SoraFiles"],
        "fr"=>["Modifier avec SoraFiles","Ouvrir SoraFiles","Quitter SoraFiles"],
        "de"=>["Mit SoraFiles bearbeiten","SoraFiles öffnen","SoraFiles beenden"],
        "pt"=>["Editar com SoraFiles","Abrir SoraFiles","Sair do SoraFiles"],
        "zh-cn"=>["使用 SoraFiles 编辑","打开 SoraFiles","退出 SoraFiles"],
        "zh-tw"=>["使用 SoraFiles 編輯","開啟 SoraFiles","結束 SoraFiles"],
        "hi"=>["SoraFiles से संपादित करें","SoraFiles खोलें","SoraFiles बंद करें"],
        "ar"=>["تحرير باستخدام SoraFiles","فتح SoraFiles","إنهاء SoraFiles"],
        "ru"=>["Редактировать в SoraFiles","Открыть SoraFiles","Выйти из SoraFiles"],
        "id"=>["Edit dengan SoraFiles","Buka SoraFiles","Keluar dari SoraFiles"],
        "it"=>["Modifica con SoraFiles","Apri SoraFiles","Esci da SoraFiles"],
        "nl"=>["Bewerken met SoraFiles","SoraFiles openen","SoraFiles afsluiten"],
        "tr"=>["SoraFiles ile düzenle","SoraFiles'ı aç","SoraFiles'tan çık"],
        "vi"=>["Chỉnh sửa bằng SoraFiles","Mở SoraFiles","Thoát SoraFiles"],
        "th"=>["แก้ไขด้วย SoraFiles","เปิด SoraFiles","ออกจาก SoraFiles"],
        "pl"=>["Edytuj w SoraFiles","Otwórz SoraFiles","Zamknij SoraFiles"],
        _=>["Edit with SoraFiles","Open SoraFiles","Quit SoraFiles"],
    };
    match key {"open"|"Open SoraFiles"=>labels[1],"quit"|"Quit SoraFiles"=>labels[2],_=>labels[0]}
}

#[cfg(test)] mod tests {
    use super::*;
    #[test] fn supported_regions_scripts_and_fallback() {
        for (input,expected) in [("ja-JP","ja"),("pt_BR.UTF-8","pt"),("zh-Hant-HK","zh-tw"),("zh_TW","zh-tw"),("zh-Hans-SG","zh-cn"),("de_DE@euro","de"),("ne-NP","en"),("","en"),("C","en")] {assert_eq!(normalize(input),expected);}
        for code in SUPPORTED {assert_eq!(effective_locale(code),code);assert!(valid_preference(code));}
        assert!(!valid_preference("JA"));assert!(!valid_preference("ja-JP"));assert_eq!(effective_locale("unknown"),"en");
    }
    #[test] fn linux_message_preferences_and_posix_override() {
        assert_eq!(linux_locale(Some("ja:en"),None,None,Some("de_DE.UTF-8")),"ja");
        assert_eq!(linux_locale(None,Some("fr_FR.UTF-8"),Some("ja_JP"),Some("de_DE")),"fr");
        assert_eq!(linux_locale(None,None,Some("ko_KR"),Some("de_DE")),"ko");
        assert_eq!(linux_locale(Some("ja"),Some("C"),None,Some("de_DE")),"en");
        assert_eq!(linux_locale(Some("ne:ja"),None,None,Some("de_DE")),"en");
        assert_eq!(linux_locale(None,None,None,None),"en");
    }
}
