//! 빌드 스크립트
//! - 트레이 아이콘(icon.png)을 RGBA 로 디코드해 OUT_DIR 에 둔다 (런타임 이미지 디코더 불필요).
//! - Windows: exe 아이콘(icon.ico) 리소스를 박는다.
//! - 페이로드 경로/ID 가 바뀌면 다시 빌드되도록 등록한다.
use std::{env, fs, path::PathBuf};

fn main() {
    let manifest = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let assets = manifest.join("..").join("data_fetcher").join("assets");
    let out = PathBuf::from(env::var("OUT_DIR").unwrap());

    // ── 트레이 아이콘 ────────────────────────────────────────────────────────
    let png_path = assets.join("icon.png");
    println!("cargo:rerun-if-changed={}", png_path.display());
    let mut decoder = png::Decoder::new(std::io::BufReader::new(
        fs::File::open(&png_path).expect("icon.png 없음"),
    ));
    decoder.set_transformations(png::Transformations::EXPAND | png::Transformations::ALPHA);
    let mut reader = decoder.read_info().expect("icon.png 디코드 실패");
    let mut buf = vec![0; reader.output_buffer_size().expect("icon.png 크기 계산 실패")];
    let info = reader.next_frame(&mut buf).expect("icon.png 프레임 읽기 실패");
    let bytes = &buf[..info.buffer_size()];
    let rgba: Vec<u8> = match info.color_type {
        png::ColorType::Rgba => bytes.to_vec(),
        png::ColorType::GrayscaleAlpha => bytes
            .chunks(2)
            .flat_map(|p| [p[0], p[0], p[0], p[1]])
            .collect(),
        other => panic!("icon.png 지원하지 않는 색 형식: {other:?}"),
    };
    fs::write(out.join("icon.rgba"), rgba).unwrap();
    fs::write(
        out.join("icon_size.rs"),
        format!("pub const ICON_W: u32 = {};\npub const ICON_H: u32 = {};\n", info.width, info.height),
    )
    .unwrap();

    // ── 페이로드 ─────────────────────────────────────────────────────────────
    println!("cargo:rerun-if-env-changed=MP_PAYLOAD");
    println!("cargo:rerun-if-env-changed=MP_PAYLOAD_ID");
    if let Ok(p) = env::var("MP_PAYLOAD") {
        println!("cargo:rerun-if-changed={p}");
    }

    // ── Windows exe 아이콘 ──────────────────────────────────────────────────
    #[cfg(windows)]
    {
        let ico = assets.join("icon.ico");
        println!("cargo:rerun-if-changed={}", ico.display());
        let mut res = winresource::WindowsResource::new();
        res.set_icon(ico.to_str().unwrap());
        res.set("FileDescription", "MarketPulse Fetcher");
        res.set("ProductName", "MarketPulse Fetcher");
        res.compile().expect("Windows 리소스 컴파일 실패");
    }
}
