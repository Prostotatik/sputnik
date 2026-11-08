"""Compare UI screenshots with doc/*-ref.png: blurred-luminance SSIM (composition) and mean colour.

Usage: python3 -I scripts/compare-refs.py <dir with f-<tab>-1222.png screenshots>
Each implementation tab should be most similar to its own reference (diagonal of the matrix).
"""
import subprocess, re, sys, itertools, os, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(ROOT, "doc")
SHOTS = sys.argv[1] if len(sys.argv) > 1 else "/tmp/shots"
os.chdir(tempfile.mkdtemp(prefix="sputnik-px-"))
W, H = 1222, 1287  # reference canvas
def prep(src, out, blur):
    # crop implementation/reference to the reference canvas, grayscale, heavy blur -> composition map
    subprocess.run(["ffmpeg","-y","-loglevel","error","-i",src,"-vf",
        f"crop={W}:{H}:0:0,scale=305:322,format=gray,gblur=sigma={blur}", out], check=True)
def ssim(a, b):
    r = subprocess.run(["ffmpeg","-i",a,"-i",b,"-lavfi","ssim","-f","null","-"], capture_output=True, text=True).stderr
    return float(re.search(r"All:([0-9.]+)", r).group(1))
def mean_rgb(src):
    r = subprocess.run(["ffmpeg","-loglevel","error","-i",src,"-vf",f"crop={W}:{H}:0:0,scale=1:1","-f","rawvideo","-pix_fmt","rgb24","-"], capture_output=True).stdout
    return tuple(r[:3])
tabs = ["games","workers","analytics"]
for t in tabs:
    prep(f"{REF}/{t}-ref.png", f"ref-{t}.png", 6)
    prep(f"{SHOTS}/f-{t}-1222.png", f"impl-{t}.png", 6)
print("Composition SSIM (blurred luminance, 1.0 = identical). Row = implementation tab, column = reference")
print(f"{'impl \\ ref':>12}" + "".join(f"{t:>11}" for t in tabs))
for i in tabs:
    print(f"{i:>12}" + "".join(f"{ssim(f'impl-{i}.png', f'ref-{r}.png'):>11.3f}" for r in tabs))
print("\nBaseline: reference vs other references")
for a, b in itertools.combinations(tabs, 2):
    print(f"  {a}-ref vs {b}-ref: {ssim(f'ref-{a}.png', f'ref-{b}.png'):.3f}")
print("\nMean colour of the canvas (RGB)")
for t in tabs:
    print(f"  {t:>9}: ref {mean_rgb(f'{REF}/{t}-ref.png')}  impl {mean_rgb(f'/tmp/shots/f-{t}-1222.png')}")
