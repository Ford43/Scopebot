from pathlib import Path
from pypdf import PdfReader
r=PdfReader(r'C:\Users\keror\Downloads\ScopeBot.pdf.pdf')
out=Path(__file__).parent
fonts=set()
for p in r.pages:
    f=p['/Resources'].get('/Font',{})
    if hasattr(f,'get_object'): f=f.get_object()
    for v in f.values(): fonts.add(str(v.get_object().get('/BaseFont')))
print(fonts)
for i in [0,13,14,15,16,17]:
    for j,im in enumerate(r.pages[i].images):
        if i==0 or im.name.endswith('.jpg'):
            (out/f'asset-{i+1}-{j}{Path(im.name).suffix}').write_bytes(im.data)
            print(i+1,j,im.name, im.image.size)
