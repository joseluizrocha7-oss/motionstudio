# Licenças de terceiros dentro do dotlottie-player.wasm

O `dotlottie-player.wasm` (guardado em `dotlottie-player.wasm.js`) é um binário compilado. O pacote npm `@lottiefiles/dotlottie-web@0.81.0` traz só a licença da LottieFiles (`LICENSE`, ao lado). Este arquivo junta as licenças do código que foi compilado dentro do `.wasm`. Os textos de licença vão sem mudança, em inglês, copiados das fontes abaixo.

## De onde vem cada parte

1. dotlottie-web 0.81.0: tag `@lottiefiles/dotlottie-web@0.81.0` de github.com/LottieFiles/dotlottie-web, commit `e34f2cf2dc609ebae482615f64be4dee4218a4eb`.
2. Nesse commit, o submódulo `packages/web/dotlottie-rs` aponta para github.com/LottieFiles/dotlottie-rs, commit `e112d3f70a5e688e4162dee199eb0531ec6cfcf6` (dotlottie-rs 0.1.58).
3. Nesse commit, o submódulo `dotlottie-rs/deps/thorvg` aponta para o ThorVG do fork github.com/theashraf/thorvg, commit `019d18c7592ad6370059f647512b00be5f5f868e` (ramo `dotlottie/video-20260812`).
4. O `packages/web/Makefile` da tag compila o `.wasm` com os recursos `tvg,tvg-cpu,tvg-png,tvg-jpg,tvg-webp,tvg-ttf,tvg-otf,tvg-lottie-expressions,dotlottie,theming,state-machines,audio,video,wasm-bindgen-api`. Pelo `dotlottie-rs/build.rs`, isso compila do ThorVG os leitores `lottie` (com RapidJSON e JerryScript), `raw`, `media`, `png` (LodePNG), `jpg` (jpgd), `webp` (libwebp) e `sfnt` (código do próprio ThorVG).
5. Conferido no binário: caminhos `deps/thorvg/src/loaders/webp/{dec,dsp,utils}/*.cpp` e `src/renderer/thorvg.rs`; os crates da tabela "Crates Rust"; `/rustc/8bab26f4f68e0e26f0bb7960be334d5b520ea452` (Rust 1.97.1); textos das expressões do Lottie (`thisComp`, `loopOut`, `wiggle`), do PNG (`IHDR`) e de fonte TrueType (`glyf`, `cmap`).

## Resumo

| Componente | Origem no ThorVG ou no dotlottie-rs | Licença |
|---|---|---|
| dotlottie-rs 0.1.58 | o próprio dotlottie-rs | MIT (texto abaixo) |
| ThorVG | `theashraf/thorvg` `019d18c7592a` | MIT (texto abaixo) |
| libwebp (decodificador WebP) | `src/loaders/webp/` | BSD-3-Clause, com concessão de patentes (textos abaixo) |
| LodePNG 20200306 | `src/loaders/png/tvgLodePng.cpp` | zlib (texto abaixo) |
| jpgd (Richard Geldreich) | `src/loaders/jpg/tvgJpgd.cpp` | domínio público, termos que o ThorVG escolheu (nota abaixo) |
| RapidJSON | `src/loaders/lottie/rapidjson/` | MIT (texto abaixo) |
| JerryScript | `src/loaders/lottie/jerryscript/` | Apache-2.0 (aviso abaixo; texto integral da Apache-2.0 no `LICENSE` da raiz do repositório) |
| crates Rust e biblioteca padrão do Rust | veja a tabela seguinte | MIT, Apache-2.0, Zlib, 0BSD, Blue Oak e BSD |

## Crates Rust

Achados no binário (versão exata no caminho gravado no `.wasm`). Licença conforme a API do crates.io para essa versão.

| Crate | Versão | Licença |
|---|---|---|
| biblioteca padrão do Rust (`std`, `core`, `alloc`) | Rust 1.97.1 (`8bab26f4`) | MIT OR Apache-2.0 (`library/std/Cargo.toml` desse commit) |
| dlmalloc (dependência da `std` no wasm) | 0.2.13 | MIT/Apache-2.0 |
| hashbrown (dependência da `std`) | 0.17.1 | MIT OR Apache-2.0 |
| miniz_oxide | 0.8.9 | MIT OR Zlib OR Apache-2.0 |
| once_cell | 1.21.4 | MIT OR Apache-2.0 |
| console_error_panic_hook | 0.1.7 | Apache-2.0/MIT |
| tinyrlibc | 0.5.1 | Blue Oak Model License 1.0.0, com trechos sob licença BSD da Universidade da Califórnia (`LICENCES.md` do crate, texto abaixo) |

Declarados no `dotlottie-rs/Cargo.toml` do commit `e112d3f70a5e` para wasm32, sem versão visível no binário. A coluna "Versões" é a faixa que o `Cargo.toml` aceita. No crates.io, todas as versões estáveis dessa faixa têm a mesma licença (conferido em 28/10/2026).

| Crate | Versões | Licença |
|---|---|---|
| rustc-hash | 2.1.1 até 2.x | Apache-2.0 OR MIT |
| thiserror | 2.x | MIT OR Apache-2.0 |
| oorandom | 11.x (a mais nova é 11.1.5) | MIT (texto abaixo) |
| bitflags | 2.6 até 2.x | MIT OR Apache-2.0 |
| wasm-bindgen | 0.2.100 até 0.2.x | MIT OR Apache-2.0 |
| js-sys | 0.3.x | MIT OR Apache-2.0 |
| web-sys | 0.3.77 (fixa) | MIT OR Apache-2.0 |
| nostd-printf | 0.1.4 até 0.1.x | MIT OR Apache-2.0 |
| adler2 (dependência do miniz_oxide 0.8.9) | 2.x (a mais nova é 2.0.1) | 0BSD OR MIT OR Apache-2.0 |

O dotlottie-rs não publica `Cargo.lock` nesse commit: o `Makefile` do dotlottie-web gera o arquivo na hora da compilação (`cargo generate-lockfile`). Por isso a lista completa, com versão exata de cada crate, não está publicada. A lista de dependências diretas está em https://github.com/LottieFiles/dotlottie-rs/blob/e112d3f70a5e688e4162dee199eb0531ec6cfcf6/dotlottie-rs/Cargo.toml.

Nos crates com a opção Apache-2.0, este repositório usa essa opção. O texto integral da Apache License 2.0 está no `LICENSE` da raiz do repositório.

## Textos

### dotlottie-rs (MIT)

Fonte: https://github.com/LottieFiles/dotlottie-rs/blob/e112d3f70a5e688e4162dee199eb0531ec6cfcf6/LICENSE

```text
MIT License

Copyright (c) 2024 LottieFiles.com

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

### ThorVG (MIT)

Fonte: https://github.com/theashraf/thorvg/blob/019d18c7592ad6370059f647512b00be5f5f868e/LICENSE (idêntico ao `LICENSE` de github.com/thorvg/thorvg, ramo `main`, commit `0347926ee35dbdf931b15257f8319b456c40a04c`).

```text
MIT License

Copyright (c) 2020 - 2026 ThorVG Project

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### libwebp: o texto que o ThorVG traz junto do decodificador

Fonte: https://github.com/theashraf/thorvg/blob/019d18c7592ad6370059f647512b00be5f5f868e/src/loaders/webp/LICENSE (idêntico ao de github.com/thorvg/thorvg, ramo `main`). Os arquivos compilados (por exemplo `src/loaders/webp/dec/vp8l.cpp`) começam com `Copyright 2012 Google Inc. All Rights Reserved.` e remetem aos arquivos COPYING e PATENTS da libwebp.

```text
# WebP (libwebp)
# Included with the ThorVG build options -Dloaders="webp" -Dstatic=true.
# This component is enabled when THORVG_WEBP_LOADER_SUPPORT and is set to 1.

Copyright 2012 Google Inc. All Rights Reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

  * Redistributions of source code must retain the above copyright
    notice, this list of conditions and the following disclaimer.

  * Redistributions in binary form must reproduce the above copyright
    notice, this list of conditions and the following disclaimer in
    the documentation and/or other materials provided with the
    distribution.

  * Neither the name of Google nor the names of its contributors may
    be used to endorse or promote products derived from this software
    without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

Additional IP Rights Grant (Patents)
-------------------------------------
"This implementation" means the copyrightable works distributed by
Google as part of the WebP project.

Google hereby grants to you a perpetual, worldwide, non-exclusive,
no-charge, royalty-free, irrevocable (except as stated in this section)
patent license to make, have made, use, offer to sell, sell, import,
transfer, and otherwise run, modify and propagate the contents of this
implementation of WebP, where such license applies only to those patent
claims, both currently owned by Google and acquired in the future,
licensable by Google that are necessarily infringed by this implementation
of WebP. This grant does not include claims that would be infringed only
as a consequence of further modification of this implementation. If you or
your agent or exclusive licensee institute or order or agree to the
institution of patent litigation against any entity (including a cross-claim
or counterclaim in a lawsuit) alleging that this implementation of WebP or
any code incorporated within this implementation of WebP constitutes direct
or contributory patent infringement, or inducement of patent infringement,
then any patent rights granted to you under this License for this
implementation of WebP shall terminate as of the date such litigation is
filed.
```

### libwebp: COPYING e PATENTS do projeto original

Fonte: github.com/webmproject/libwebp, ramo `main`, commit `1844042d1ca751e62e61df7617dba19c98588339` (19/10/2026). Não achei qual versão da libwebp deu origem à cópia do ThorVG, e o texto atual é diferente do texto acima (ano do copyright e redação da concessão de patentes). Os 2 vão aqui.

COPYING:

```text
Copyright (c) 2010, Google Inc. All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

  * Redistributions of source code must retain the above copyright
    notice, this list of conditions and the following disclaimer.

  * Redistributions in binary form must reproduce the above copyright
    notice, this list of conditions and the following disclaimer in
    the documentation and/or other materials provided with the
    distribution.

  * Neither the name of Google nor the names of its contributors may
    be used to endorse or promote products derived from this software
    without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

PATENTS:

```text
Additional IP Rights Grant (Patents)
------------------------------------

"These implementations" means the copyrightable works that implement the WebM
codecs distributed by Google as part of the WebM Project.

Google hereby grants to you a perpetual, worldwide, non-exclusive, no-charge,
royalty-free, irrevocable (except as stated in this section) patent license to
make, have made, use, offer to sell, sell, import, transfer, and otherwise
run, modify and propagate the contents of these implementations of WebM, where
such license applies only to those patent claims, both currently owned by
Google and acquired in the future, licensable by Google that are necessarily
infringed by these implementations of WebM. This grant does not include claims
that would be infringed only as a consequence of further modification of these
implementations. If you or your agent or exclusive licensee institute or order
or agree to the institution of patent litigation or any other patent
enforcement activity against any entity (including a cross-claim or
counterclaim in a lawsuit) alleging that any of these implementations of WebM
or any code incorporated within any of these implementations of WebM
constitute direct or contributory patent infringement, or inducement of
patent infringement, then any patent rights granted to you under this License
for these implementations of WebM shall terminate as of the date such
litigation is filed.
```

### LodePNG (zlib)

Fonte: cabeçalho de https://github.com/theashraf/thorvg/blob/019d18c7592ad6370059f647512b00be5f5f868e/src/loaders/png/tvgLodePng.cpp

```text
/*
  LodePNG version 20200306

  Copyright (c) 2005-2020 Lode Vandevenne

  This software is provided 'as-is', without any express or implied
  warranty. In no event will the authors be held liable for any damages
  arising from the use of this software.

  Permission is granted to anyone to use this software for any purpose,
  including commercial applications, and to alter it and redistribute it
  freely, subject to the following restrictions:

    1. The origin of this software must not be misrepresented; you must not
    claim that you wrote the original software. If you use this software
    in a product, an acknowledgment in the product documentation would be
    appreciated but is not required.

    2. Altered source versions must be plainly marked as such, and must not be
    misrepresented as being the original software.

    3. This notice may not be removed or altered from any sourcedistribution.
*/
```

### jpgd (domínio público)

Fonte: cabeçalho de https://github.com/theashraf/thorvg/blob/019d18c7592ad6370059f647512b00be5f5f868e/src/loaders/jpg/tvgJpgd.cpp

```text
/*
 * Originally dual-licensed by Richard Geldreich <richgel99@gmail.com> between 1994-2020.
 * Public Domain or Apache License 2.0.
 * ThorVG uses it under the Public Domain terms.
 */
```

### RapidJSON (MIT)

Fonte: https://github.com/theashraf/thorvg/blob/019d18c7592ad6370059f647512b00be5f5f868e/src/loaders/lottie/rapidjson/LICENSE

```text
# RapidJSON
# Included with the ThorVG build options -Dloaders="lottie" (default).
# This component is enabled when THORVG_LOTTIE_LOADER_SUPPORT is set to 1.
 
Copyright (C) 2015 THL A29 Limited, a Tencent company, and Milo Yip. All rights reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### JerryScript (Apache-2.0)

Fonte: https://github.com/theashraf/thorvg/blob/019d18c7592ad6370059f647512b00be5f5f868e/src/loaders/lottie/jerryscript/jerry-core/LICENSE. A cópia do ThorVG não traz arquivo NOTICE. O texto integral da Apache License 2.0 está no `LICENSE` da raiz deste repositório.

```text
# JerryScript
# Included with the ThorVG build options -Dloaders="lottie" (default) and -Dextra="lottie_exp" (default).
# This component is enabled when THORVG_LOTTIE_EXPRESSIONS_SUPPORT is set to 1.

Copyright JS Foundation and other contributors, http://js.foundation

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

** NOTICE for Apache License 2.0 and GPL v2 compatibility **
The Apache License 2.0 (ALv2) is NOT compatible with GNU General Public
License version 2 (GPLv2). If you are integrating ThorVG with a GPLv2
project, you must ensure that the JerryScript component (ALv2) is either
used as a separate, dynamically linked module or replaced with a
GPLv2-compatible alternative. The main ThorVG library (MIT) is compatible
with both GPLv2 and GPLv3, but the bundled JerryScript component is not.
```

### tinyrlibc 0.5.1 (Blue Oak 1.0.0 e BSD)

Fonte: `LICENCES.md` do pacote https://static.crates.io/crates/tinyrlibc/tinyrlibc-0.5.1.crate (sha256 `9af8adde15cc59c61328c5d709b41b8464522a733033584d33def687b26bd009`).

```text
# Blue Oak Model License

Version 1.0.0

## Purpose

This license gives everyone as much permission to work with
this software as possible, while protecting contributors
from liability.

## Acceptance

In order to receive this license, you must agree to its
rules.  The rules of this license are both obligations
under that agreement and conditions to your license.
You must not do anything with this software that triggers
a rule that you cannot or will not follow.

## Copyright

Each contributor licenses you to do everything with this
software that would otherwise infringe that contributor's
copyright in it.

## Notices

You must ensure that everyone who gets a copy of
any part of this software from you, with or without
changes, also gets the text of this license or a link to
<https://blueoakcouncil.org/license/1.0.0>.

## Excuse

If anyone notifies you in writing that you have not
complied with [Notices](#notices), you can keep your
license by taking all practical steps to comply within 30
days after the notice.  If you do not do so, your license
ends immediately.

## Patent

Each contributor licenses you to do everything with this
software that would otherwise infringe any patent claims
they can license or become able to license.

## Reliability

No contributor can revoke this license.

## No Liability

***As far as the law allows, this software comes as is,
without any warranty or condition, and no contributor
will be liable to anyone for any damages related to this
software or this license, under any kind of legal claim.***

# Copyright (c) 1990 Regents of the University of California

All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions
are met:
1. Redistributions of source code must retain the above copyright
   notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright
   notice, this list of conditions and the following disclaimer in the
   documentation and/or other materials provided with the distribution.
3. [rescinded 22 July 1999]
4. Neither the name of the University nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE REGENTS AND CONTRIBUTORS ``AS IS'' AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
ARE DISCLAIMED.  IN NO EVENT SHALL THE REGENTS OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
SUCH DAMAGE.
```

### oorandom 11.1.5 (MIT)

Fonte: `LICENSE-MIT` do pacote https://static.crates.io/crates/oorandom/oorandom-11.1.5.crate

```text
The MIT License (MIT)

Copyright (c) 2019 Simon Heath

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
