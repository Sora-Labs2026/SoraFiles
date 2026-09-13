use std::collections::HashSet;
use std::io::{Read, Seek, SeekFrom};

// Identify content for tool suggestions only. Engines must still decode and
// validate the complete document before producing an output.
fn signature(head: &[u8]) -> Option<&'static str> {
    if head.starts_with(b"%PDF-") { return Some("PDF"); }
    if head.starts_with(b"\x89PNG\r\n\x1a\n") { return Some("PNG"); }
    if head.starts_with(b"\xff\xd8\xff") { return Some("JPG"); }
    if head.starts_with(b"GIF87a") || head.starts_with(b"GIF89a") { return Some("GIF"); }
    if head.starts_with(b"RIFF") && head.get(8..12) == Some(b"WEBP") { return Some("WebP"); }
    if [b"II\x2a\0", b"MM\0\x2a", b"II\x2b\0", b"MM\0\x2b"].iter().any(|value| head.starts_with(*value)) { return Some("TIFF"); }
    if head.starts_with(b"8BPS\0\x01") { return Some("PSD"); }
    if head.len() >= 20 && &head[4..8] == b"ftyp" {
        let size = u32::from_be_bytes(head[..4].try_into().ok()?) as usize;
        if size < 20 || size > head.len() || size > 4096 || size % 4 != 0 { return None; }
        let brands = std::iter::once(&head[8..12]).chain(head[16..size].chunks_exact(4));
        let mut generic = false; let mut heic = false;
        for brand in brands {
            if matches!(brand, b"avif" | b"avis") { return None; }
            heic |= matches!(brand, b"heic" | b"heix" | b"hevc" | b"hevx");
            generic |= matches!(brand, b"mif1" | b"msf1");
        }
        if heic { return Some("HEIC"); }
        if generic { return Some("HEIF"); }
    }
    None
}
fn u16le(bytes: &[u8], at: usize) -> Option<u16> { Some(u16::from_le_bytes(bytes.get(at..at.checked_add(2)?)?.try_into().ok()?)) }
fn u32le(bytes: &[u8], at: usize) -> Option<u32> { Some(u32::from_le_bytes(bytes.get(at..at.checked_add(4)?)?.try_into().ok()?)) }
fn office(reader: &mut (impl Read + Seek), size: u64) -> Option<&'static str> {
    // Read central-directory names, never inflate attacker-controlled ZIP data.
    let mut tail = vec![0; size.min(65557) as usize];
    reader.seek(SeekFrom::Start(size - tail.len() as u64)).ok()?;
    reader.read_exact(&mut tail).ok()?;
    let end = (0..=tail.len().checked_sub(22)?).rev().find(|&at|
        u32le(&tail, at) == Some(0x06054b50) && u16le(&tail, at + 20).is_some_and(|comment| at + 22 + comment as usize == tail.len()))?;
    let count = u16le(&tail, end + 10)? as usize;
    let length = u32le(&tail, end + 12)? as usize;
    let offset = u32le(&tail, end + 16)? as u64;
    if u16le(&tail, end + 4)? != 0 || u16le(&tail, end + 6)? != 0
        || u16le(&tail, end + 8)? as usize != count || count == 0 || count > 2048
        || length > 1048576 || offset + length as u64 != size - tail.len() as u64 + end as u64 { return None; }
    let mut directory = vec![0; length];
    reader.seek(SeekFrom::Start(offset)).ok()?; reader.read_exact(&mut directory).ok()?;
    let mut names = HashSet::new(); let mut at = 0usize; let mut expanded = 0u64;
    for _ in 0..count {
        if at.checked_add(46)? > length || u32le(&directory, at)? != 0x02014b50 { return None; }
        let flags = u16le(&directory, at + 8)?;
        let unpacked = u32le(&directory, at + 24)? as u64;
        let name_len = u16le(&directory, at + 28)? as usize;
        let extra = u16le(&directory, at + 30)? as usize;
        let comment = u16le(&directory, at + 32)? as usize;
        let next = at.checked_add(46 + name_len + extra + comment)?;
        expanded += unpacked;
        if flags & 0x41 != 0 || u16le(&directory, at + 34)? != 0 || next > length
            || expanded > 512 * 1024 * 1024 || u32le(&directory, at + 42)? as u64 >= offset { return None; }
        let name = std::str::from_utf8(&directory[at + 46..at + 46 + name_len]).ok()?;
        if name.is_empty() || name.starts_with('/') || name.contains(['\\', ':']) || name.chars().any(char::is_control)
            || name.split('/').any(|part| part == ".." || part == ".") || !names.insert(name) { return None; }
        at = next;
    }
    if at != length || !names.contains("[Content_Types].xml") { return None; }
    match (names.contains("word/document.xml"), names.contains("xl/workbook.xml")) {
        (true, false) => Some("DOCX"), (false, true) => Some("XLSX"), _ => None,
    }
}
pub fn classify(reader: &mut (impl Read + Seek), size: u64) -> std::io::Result<Option<&'static str>> {
    let mut head = vec![0; size.min(4096) as usize];
    reader.seek(SeekFrom::Start(0))?; reader.read_exact(&mut head)?;
    Ok(signature(&head).or_else(|| head.starts_with(b"PK\x03\x04").then(|| office(reader, size)).flatten()))
}

#[cfg(test)] mod tests {
    use super::*;
    use std::io::Cursor;
    fn identify(bytes: &[u8]) -> Option<&'static str> { classify(&mut Cursor::new(bytes), bytes.len() as u64).unwrap() }
    #[test] fn image_signatures_do_not_depend_on_names() {
        for (head, expected) in [(b"%PDF-1.7".as_slice(),"PDF"),(b"\x89PNG\r\n\x1a\n","PNG"),(b"\xff\xd8\xff","JPG"),(b"GIF89a","GIF"),(b"RIFF\0\0\0\0WEBP","WebP"),(b"II\x2a\0","TIFF"),(b"8BPS\0\x01","PSD")] {
            assert_eq!(identify(head),Some(expected));
        }
        for head in [b"renamed.pdf".as_slice(), b"GIF", b"RIFFWEBP", b"MZ", b"8BPS\0\x02"] { assert_eq!(identify(head),None); }
    }
    #[test] fn heif_brand_box_is_bounded_and_compatible_brands_are_checked() {
        let mut box_bytes = b"\0\0\0\x18ftypmif1\0\0\0\0mif1heic".to_vec();
        assert_eq!(identify(&box_bytes),Some("HEIC"));box_bytes[20..24].copy_from_slice(b"mif1");assert_eq!(identify(&box_bytes),Some("HEIF"));
        box_bytes[20..24].copy_from_slice(b"avif");assert_eq!(identify(&box_bytes),None);box_bytes[20..24].copy_from_slice(b"mif1");
        for size in [0u32, 16, 23, 28, u32::MAX] { box_bytes[..4].copy_from_slice(&size.to_be_bytes());assert_eq!(identify(&box_bytes),None); }
    }
    fn zip(names: &[&str]) -> Vec<u8> {
        let mut bytes=b"PK\x03\x04".to_vec();let mut directory=Vec::new();
        for name in names {
            let mut entry=vec![0u8;46];entry[..4].copy_from_slice(&0x02014b50u32.to_le_bytes());
            entry[28..30].copy_from_slice(&(name.len() as u16).to_le_bytes());directory.extend(entry);directory.extend(name.as_bytes());
        }
        bytes.extend(&directory);let mut end=vec![0u8;22];end[..4].copy_from_slice(&0x06054b50u32.to_le_bytes());
        end[8..10].copy_from_slice(&(names.len() as u16).to_le_bytes());end[10..12].copy_from_slice(&(names.len() as u16).to_le_bytes());
        end[12..16].copy_from_slice(&(directory.len() as u32).to_le_bytes());end[16..20].copy_from_slice(&4u32.to_le_bytes());bytes.extend(end);bytes
    }
    #[test] fn office_suggestions_require_unambiguous_bounded_directory_names() {
        for (names, result) in [(vec!["[Content_Types].xml","word/document.xml"],Some("DOCX")),(vec!["[Content_Types].xml","xl/workbook.xml"],Some("XLSX")),(vec!["word/document.xml"],None),(vec!["[Content_Types].xml","word/document.xml","xl/workbook.xml"],None)] { assert_eq!(identify(&zip(&names)),result); }
        for name in ["../secret", "/absolute", "C:/drive", "dir\\file", "word/document.xml"] {
            assert_eq!(identify(&zip(&["[Content_Types].xml","word/document.xml",name])),None);
        }
        let valid=zip(&["[Content_Types].xml","word/document.xml"]);
        for cut in 0..valid.len() { assert_eq!(identify(&valid[..cut]),None); }
        for (at, bad) in [(12,1u8),(38,1),(46,255)] { let mut altered=valid.clone();altered[at]=bad;assert_eq!(identify(&altered),None); }
        let mut huge=valid.clone();let at=huge.len()-10;huge[at..at+4].copy_from_slice(&u32::MAX.to_le_bytes());assert_eq!(identify(&huge),None);
    }
}
