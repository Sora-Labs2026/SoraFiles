// File-dialog extensions for the format names tools declare. Unknown names
// map to nothing, so the bridge rejects them.
pub fn extensions(format: &str) -> &'static [&'static str] {
    match format {
        "PDF" => &["pdf"],
        "JPG" => &["jpg", "jpeg"],
        "PNG" => &["png"],
        "WebP" => &["webp"],
        "GIF" => &["gif"],
        "TIFF" => &["tif", "tiff"],
        "HEIC" => &["heic"],
        "HEIF" => &["heif"],
        "PSD" => &["psd"],
        "DOCX" => &["docx"],
        "XLSX" => &["xlsx"],
        "PPTX" => &["pptx"],
        _ => &[],
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn known_formats_have_extensions_and_others_none() {
        assert_eq!(super::extensions("JPG"), &["jpg", "jpeg"]);
        assert!(super::extensions("EXE").is_empty());
        assert!(super::extensions("pdf").is_empty(), "format names are exact");
    }
}
