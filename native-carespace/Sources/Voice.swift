import SwiftUI
import Speech
import AVFoundation

// MARK: Item 14 — voice dictation. Talk, and your words land in the
// field. The phone's own speech recognition does the hearing; a
// denied permission says so in plain words and typing still works.

@MainActor
final class VoiceEngine: ObservableObject {
    @Published var listening = false
    @Published var problem = ""
    private let recognizer = SFSpeechRecognizer()
    private let engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    var onText: ((String) -> Void)?

    func toggle() {
        if listening { stop() } else { Task { await start() } }
    }

    func start() async {
        problem = ""
        let speechOK = await withCheckedContinuation { (c: CheckedContinuation<Bool, Never>) in
            SFSpeechRecognizer.requestAuthorization { c.resume(returning: $0 == .authorized) }
        }
        guard speechOK else { problem = "Voice typing needs speech permission. You can turn it on in Settings, or keep typing."; return }
        let micOK = await AVAudioApplication.requestRecordPermission()
        guard micOK else { problem = "Voice typing needs the microphone. You can turn it on in Settings, or keep typing."; return }
        guard let recognizer, recognizer.isAvailable else { problem = "Voice typing is not available right now. Typing still works."; return }
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setActive(true, options: .notifyOthersOnDeactivation)
            let req = SFSpeechAudioBufferRecognitionRequest()
            req.shouldReportPartialResults = true
            request = req
            let input = engine.inputNode
            let format = input.outputFormat(forBus: 0)
            input.removeTap(onBus: 0)
            input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak req] buffer, _ in
                req?.append(buffer)
            }
            engine.prepare()
            try engine.start()
            listening = true
            task = recognizer.recognitionTask(with: req) { [weak self] result, error in
                guard let self else { return }
                if let result {
                    let text = result.bestTranscription.formattedString
                    Task { @MainActor in self.onText?(text) }
                }
                if error != nil || (result?.isFinal ?? false) {
                    Task { @MainActor in self.stop() }
                }
            }
        } catch {
            problem = "Voice typing could not start. Typing still works."
            stop()
        }
    }

    func stop() {
        if engine.isRunning { engine.stop() }
        engine.inputNode.removeTap(onBus: 0)
        request?.endAudio()
        task?.cancel()
        request = nil; task = nil
        listening = false
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}

/// The mic button that sits beside a field. Tap to talk, tap to stop;
/// words stream into the binding as you speak.
struct VoiceMicButton: View {
    @Binding var text: String
    @StateObject private var voice = VoiceEngine()
    @State private var base = ""
    var body: some View {
        VStack(spacing: 4) {
            Button {
                if voice.listening { voice.stop() } else {
                    base = text
                    voice.onText = { heard in
                        text = base.isEmpty ? heard : base + " " + heard
                    }
                    voice.toggle()
                }
            } label: {
                ZStack {
                    Circle().fill(voice.listening ? Color(hex: 0xB03A48) : Brand.ink)
                        .frame(width: 48, height: 48)
                    CareIcon(name: "mic", size: 24, tint: .white, fill: false)
                }
            }
            .accessibilityLabel(voice.listening ? "Stop voice typing" : "Voice typing")
            if !voice.problem.isEmpty {
                Text(voice.problem).font(Brand.body(13)).foregroundStyle(Color(hex: 0xB03A48))
            }
        }
        .onDisappear { if voice.listening { voice.stop() } }
    }
}
