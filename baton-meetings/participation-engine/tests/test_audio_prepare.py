import unittest, tempfile, hashlib, json, wave, struct, math, importlib.util
from pathlib import Path
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("audio_prepare",root/"src"/"audio_prepare.py")
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
class TestPrepare(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix="mj-test-")
        self.p=Path(self.tmp.name)
        self.wav=self.p/"remote.wav"
        with wave.open(str(self.wav),"wb") as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(48000)
            for i in range(48000):
                x=int(1000*math.sin(2*math.pi*440*i/48000))
                w.writeframesraw(struct.pack("<hh",x,x))
        self.source={
          "schema_version":1,"consent_confirmed_by_operator":True,"test_fixture":True,
          "tracks":[{"source":"remote","file":"remote.wav","ok":True,
             "sha256":hashlib.sha256(self.wav.read_bytes()).hexdigest(),
             "capture_started_at":"2026-10-18T00:00:00+00:00","non_silent_blocks":10}]
        }
        self.save()
    def save(self):
        (self.p/"manifest.json").write_text(json.dumps(self.source))
    def tearDown(self):
        self.tmp.cleanup()
    def test_conversion(self):
        out=mod.prepare(self.p/"manifest.json")
        self.assertEqual(out["chunks"],1)
        with wave.open(str(self.p/"prepared"/"remote-00000.wav"),"rb") as w:
            self.assertEqual((w.getnchannels(),w.getframerate(),w.getsampwidth()),(1,16000,2))
            self.assertAlmostEqual(w.getnframes()/16000,1,delta=.01)
    def test_tampering(self):
        self.source["tracks"][0]["sha256"]="a"*64
        self.save()
        with self.assertRaisesRegex(ValueError,"TRACK_AUDIO_HASH_MISMATCH"):
            mod.prepare(self.p/"manifest.json")
    def test_permission(self):
        self.source["consent_confirmed_by_operator"]=False
        self.save()
        with self.assertRaisesRegex(ValueError,"CAPTURE_CONSENT_EVIDENCE_REQUIRED"):
            mod.prepare(self.p/"manifest.json")
    def test_reject_traversal(self):
        self.source["tracks"][0]["file"]="../remote.wav"
        self.save()
        with self.assertRaisesRegex(ValueError,"INVALID_TRACK_IDENTITY"):
            mod.prepare(self.p/"manifest.json")
if __name__=="__main__":
    unittest.main()
