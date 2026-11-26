import Foundation
import AVFoundation
import CoreGraphics
import AppKit

struct SubCue: Decodable {
    let text: String
    let s: Double
    let e: Double
    let accent: Bool
}

let args = CommandLine.arguments
guard args.count >= 4 else {
    fatalError("Usage: swift burn_episode_loop.swift <in_mp4> <subs_json> <out_mp4>")
}

let inVideoPath = args[1]
let subsJsonPath = args[2]
let outVideoPath = args[3]

guard let jsonData = try? Data(contentsOf: URL(fileURLWithPath: subsJsonPath)),
      let cues = try? JSONDecoder().decode([SubCue].self, from: jsonData) else {
    fatalError("Failed to load \(subsJsonPath)")
}

let asset = AVURLAsset(url: URL(fileURLWithPath: inVideoPath))
guard let videoTrack = asset.tracks(withMediaType: .video).first else {
    fatalError("No video track in \(inVideoPath)")
}

let width = Int(videoTrack.naturalSize.width)
let height = Int(videoTrack.naturalSize.height)
print("Burning \(cues.count) subtitle cues + subtle watermark (NO dark outro for seamless YT Shorts loop!) onto \(width)x\(height)")

let reader = try AVAssetReader(asset: asset)
let readerOutput = AVAssetReaderTrackOutput(
    track: videoTrack,
    outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA)]
)
readerOutput.alwaysCopiesSampleData = false
reader.add(readerOutput)

let outURL = URL(fileURLWithPath: outVideoPath)
if FileManager.default.fileExists(atPath: outVideoPath) {
    try? FileManager.default.removeItem(at: outURL)
}

let writer = try AVAssetWriter(outputURL: outURL, fileType: .mp4)
let writerSettings: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height,
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 16_000_000,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel
    ]
]
let writerInput = AVAssetWriterInput(mediaType: .video, outputSettings: writerSettings)
writerInput.expectsMediaDataInRealTime = false

let adaptor = AVAssetWriterInputPixelBufferAdaptor(
    assetWriterInput: writerInput,
    sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA),
        kCVPixelBufferWidthKey as String: width,
        kCVPixelBufferHeightKey as String: height,
        kCVPixelBufferCGImageCompatibilityKey as String: true,
        kCVPixelBufferCGBitmapContextCompatibilityKey as String: true
    ]
)
writer.add(writerInput)

guard reader.startReading() else { fatalError("Reader error: \(String(describing: reader.error))") }
guard writer.startWriting() else { fatalError("Writer error: \(String(describing: writer.error))") }
writer.startSession(atSourceTime: .zero)

let colorSpace = CGColorSpaceCreateDeviceRGB()
let bitmapInfo = CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue

func activeCue(at t: Double) -> SubCue? {
    for c in cues { if t >= c.s && t <= c.e { return c } }
    return nil
}

func drawWatermark(_ ctx: CGContext, w: CGFloat, h: CGFloat) {
    let text = "Powered by Naltech"
    let font = NSFont.systemFont(ofSize: 28, weight: .bold)
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = .center
    let centerX = w * 0.5
    let centerY = h * 0.956

    ctx.saveGState()
    ctx.translateBy(x: 0, y: h)
    ctx.scaleBy(x: 1, y: -1)
    NSGraphicsContext.current = NSGraphicsContext(cgContext: ctx, flipped: true)

    let drawRect = CGRect(x: centerX - 280, y: centerY - 22, width: 560, height: 44)
    let shadowAttr: [NSAttributedString.Key: Any] = [
        .font: font,
        .foregroundColor: NSColor(srgbRed: 0, green: 0, blue: 0, alpha: 0.62),
        .paragraphStyle: paragraph
    ]
    let sStr = NSAttributedString(string: text, attributes: shadowAttr)
    for (dx, dy) in [(0.0, 2.2), (-1.4, 0.0), (1.4, 0.0), (0.0, -1.4), (0.0, 1.4)] {
        sStr.draw(in: drawRect.offsetBy(dx: dx, dy: dy))
    }
    let fillAttr: [NSAttributedString.Key: Any] = [
        .font: font,
        .foregroundColor: NSColor(srgbRed: 1, green: 1, blue: 1, alpha: 0.88),
        .paragraphStyle: paragraph
    ]
    NSAttributedString(string: text, attributes: fillAttr).draw(in: drawRect)
    ctx.restoreGState()
}

func drawViralSubtitle(_ ctx: CGContext, cue: SubCue, t: Double, w: CGFloat, h: CGFloat) {
    let dt = t - cue.s
    let pop: CGFloat
    if dt < 0.08 {
        let u = CGFloat(dt / 0.08)
        pop = 0.86 + 0.19 * (1.0 - pow(1.0 - u, 3))
    } else if dt < 0.15 {
        let u = CGFloat((dt - 0.08) / 0.07)
        pop = 1.05 - 0.05 * u
    } else {
        pop = 1.0
    }

    var fontSize: CGFloat = cue.accent ? 74.0 : 68.0
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = .center
    paragraph.lineSpacing = 4

    func measure(_ sz: CGFloat) -> (NSFont, CGSize) {
        let f = NSFont.systemFont(ofSize: sz, weight: .black)
        let s = (cue.text as NSString).boundingRect(
            with: CGSize(width: w - 140, height: 400),
            options: [.usesLineFragmentOrigin, .usesFontLeading],
            attributes: [.font: f, .paragraphStyle: paragraph]
        ).size
        return (f, s)
    }

    var (font, textSize) = measure(fontSize)
    while textSize.height > 185 && fontSize > 48 {
        fontSize -= 4
        (font, textSize) = measure(fontSize)
    }

    let centerX = w * 0.5
    let centerY = h * 0.725

    ctx.saveGState()
    ctx.translateBy(x: 0, y: h)
    ctx.scaleBy(x: 1, y: -1)
    ctx.translateBy(x: centerX, y: centerY)
    ctx.scaleBy(x: pop, y: pop)
    NSGraphicsContext.current = NSGraphicsContext(cgContext: ctx, flipped: true)

    let boxW = w - 140
    let boxH = ceil(textSize.height) + 24
    let drawRect = CGRect(x: -boxW / 2, y: -boxH / 2, width: boxW, height: boxH)

    let shadowAttr: [NSAttributedString.Key: Any] = [
        .font: font,
        .foregroundColor: NSColor(srgbRed: 0, green: 0, blue: 0, alpha: 0.55),
        .paragraphStyle: paragraph
    ]
    NSAttributedString(string: cue.text, attributes: shadowAttr).draw(in: drawRect.offsetBy(dx: 0, dy: 8))

    let outlineAttr: [NSAttributedString.Key: Any] = [
        .font: font,
        .foregroundColor: NSColor(srgbRed: 0.04, green: 0.04, blue: 0.06, alpha: 1.0),
        .paragraphStyle: paragraph
    ]
    let outlineStr = NSAttributedString(string: cue.text, attributes: outlineAttr)
    let r: CGFloat = 6.5
    for k in 0..<16 {
        let a = CGFloat(k) * (.pi * 2.0 / 16.0)
        outlineStr.draw(in: drawRect.offsetBy(dx: cos(a) * r, dy: sin(a) * r))
    }

    let fillCol = cue.accent ? NSColor(srgbRed: 1.0, green: 0.86, blue: 0.22, alpha: 1.0) : NSColor.white
    let fillAttr: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: fillCol, .paragraphStyle: paragraph]
    NSAttributedString(string: cue.text, attributes: fillAttr).draw(in: drawRect)
    ctx.restoreGState()
}

var frameCount = 0
let startTime = Date()

while let sampleBuffer = readerOutput.copyNextSampleBuffer() {
    let pts = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
    let t = CMTimeGetSeconds(pts)
    guard let imgBuf = CMSampleBufferGetImageBuffer(sampleBuffer) else { continue }
    while !writerInput.isReadyForMoreMediaData { usleep(1000) }

    CVPixelBufferLockBaseAddress(imgBuf, [])
    if let base = CVPixelBufferGetBaseAddress(imgBuf) {
        let bpr = CVPixelBufferGetBytesPerRow(imgBuf)
        if let ctx = CGContext(data: base, width: width, height: height, bitsPerComponent: 8, bytesPerRow: bpr, space: colorSpace, bitmapInfo: bitmapInfo) {
            if let cue = activeCue(at: t) {
                drawViralSubtitle(ctx, cue: cue, t: t, w: CGFloat(width), h: CGFloat(height))
            }
            drawWatermark(ctx, w: CGFloat(width), h: CGFloat(height))
        }
    }
    CVPixelBufferUnlockBaseAddress(imgBuf, [])
    adaptor.append(imgBuf, withPresentationTime: pts)
    frameCount += 1
    if frameCount % 300 == 0 {
        print("  Processed \(frameCount) frames [\(String(format: "%.1f", t))s]...")
    }
}

writerInput.markAsFinished()
let group = DispatchGroup()
group.enter()
writer.finishWriting { group.leave() }
group.wait()

print("DONE (Seamless Loop): \(frameCount) frames in \(String(format: "%.1f", Date().timeIntervalSince(startTime)))s -> \(outVideoPath)")
