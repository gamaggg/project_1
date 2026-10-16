import re,io,subprocess,sys
ru=io.open('lib/i18n/ru.ts',encoding='utf-8').read()
# build set of paths: parse nested one/two-level object roughly
paths=set(); ns=None
for line in ru.split('\n'):
    m=re.match(r"^  (\w+): \{\s*$",line)
    if m: ns=m.group(1); continue
    m=re.match(r"^  (\w+): ",line)
    if m and ns is None: pass
    if line.startswith('  },'): ns=None; continue
    m=re.match(r"^    (\w+):",line)
    if m and ns: paths.add(ns+'.'+m.group(1))
    m=re.match(r"^  (\w+): \{ ",line)
    if m: paths.add(m.group(1))
files=subprocess.check_output("grep -rl \"tn\\|tnd\\|useT\" app components lib --include=*.ts --include=*.tsx | grep -v 'lib/i18n/'",shell=True,text=True).split()
bad=0
for f in files:
    s=io.open(f,encoding='utf-8').read()
    for m in re.finditer(r"\btnd?\(\s*'([\w]+\.[\w]+)'",s):
        k=m.group(1)
        if k not in paths: print(f,k); bad+=1
print('missing',bad)
