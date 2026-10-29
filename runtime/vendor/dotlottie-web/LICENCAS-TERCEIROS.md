# Licenças de terceiros dentro do dotlottie-player.wasm

O `dotlottie-player.wasm` (guardado em `dotlottie-player.wasm.js`) é um binário compilado. O pacote npm `@lottiefiles/dotlottie-web@0.81.0` traz só a licença da LottieFiles (`LICENSE`, ao lado). Este arquivo junta as licenças do código que foi compilado dentro do `.wasm`. Os textos de licença vão sem mudança, em inglês, copiados das fontes abaixo.

## De onde vem cada parte

1. dotlottie-web 0.81.0: tag `@lottiefiles/dotlottie-web@0.81.0` de github.com/LottieFiles/dotlottie-web, commit `e34f2cf2dc609ebae482615f64be4dee4218a4eb`.
2. Nesse commit, o submódulo `packages/web/dotlottie-rs` aponta para github.com/LottieFiles/dotlottie-rs, commit `e112d3f70a5e688e4162dee199eb0531ec6cfcf6` (dotlottie-rs 0.1.58).
3. Nesse commit, o submódulo `dotlottie-rs/deps/thorvg` aponta para o ThorVG do fork github.com/theashraf/thorvg, commit `019d18c7592ad6370059f647512b00be5f5f868e` (ramo `dotlottie/video-20260812`).
4. O `packages/web/Makefile` da tag compila o `.wasm` com os recursos `tvg,tvg-cpu,tvg-png,tvg-jpg,tvg-webp,tvg-ttf,tvg-otf,tvg-lottie-expressions,dotlottie,theming,state-machines,audio,video,wasm-bindgen-api`. Pelo `dotlottie-rs/build.rs`, isso compila do ThorVG os leitores `lottie` (com RapidJSON e JerryScript), `raw`, `media`, `png` (LodePNG), `jpg` (jpgd), `webp` (libwebp) e `sfnt` (código do próprio ThorVG).
5. Conferido no binário: caminhos `deps/thorvg/src/loaders/webp/{dec,dsp,utils}/*.cpp` e `src/renderer/thorvg.rs`; os crates da tabela "Crates Rust"; `/rustc/8bab26f4f68e0e26f0bb7960be334d5b520ea452` (Rust 1.97.1); textos das expressões do Lottie (`thisComp`, `loopOut`, `wiggle`), do PNG (`IHDR`) e de fonte TrueType (`glyf`, `cmap`).
6. Varredura dos fontes: 583 arquivos `.cpp`/`.h` das pastas que o `build.rs` compila (no ThorVG: `inc`, `src/common`, `src/bindings/capi`, `src/renderer`, `src/renderer/cpu_engine` e os leitores do passo 4; no dotlottie-rs: `dotlottie-rs/cpp`), atrás de avisos de copyright e de licença de terceiros nas primeiras 400 linhas de cada arquivo. Tudo o que apareceu está no resumo abaixo.

## Resumo

| Componente | Origem no ThorVG ou no dotlottie-rs | Licença |
|---|---|---|
| dotlottie-rs 0.1.58 | o próprio dotlottie-rs | MIT (texto abaixo) |
| ThorVG | `theashraf/thorvg` `019d18c7592a` | MIT (texto abaixo) |
| FreeType (o rasterizador da CPU do ThorVG deriva dele) | `src/renderer/cpu_engine/tvgSwRle.cpp` | The FreeType Project LICENSE (FTL), que exige crédito ao FreeType Team na documentação (texto abaixo; o crédito está no `NOTICE` da raiz) |
| interpolador de curvas do Lottie | `src/loaders/lottie/tvgLottieInterpolator.cpp` | MPL-2.0 (onde obter o fonte e o texto da licença, abaixo) |
| libwebp (decodificador WebP) | `src/loaders/webp/` | BSD-3-Clause, com concessão de patentes (textos abaixo); os arquivos trazem `Copyright 2010` a `2015 Google Inc.` |
| LodePNG 20200306 | `src/loaders/png/tvgLodePng.cpp` | zlib (texto abaixo) |
| jpgd (Richard Geldreich) | `src/loaders/jpg/tvgJpgd.cpp` | domínio público, termos que o ThorVG escolheu (nota abaixo) |
| RapidJSON | `src/loaders/lottie/rapidjson/` | MIT (texto abaixo) |
| JerryScript | `src/loaders/lottie/jerryscript/` | Apache-2.0 (aviso abaixo; texto integral da Apache-2.0 no `LICENSE` da raiz do repositório) |
| Errol (Marc Andrysco), dentro do JerryScript | `src/loaders/lottie/jerryscript/jerry-core/ecma/base/ecma-helpers-errol.cpp` | MIT (texto abaixo) |
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

### FreeType (The FreeType Project LICENSE)

Fonte: cabeçalho de https://github.com/theashraf/thorvg/blob/019d18c7592ad6370059f647512b00be5f5f868e/src/renderer/cpu_engine/tvgSwRle.cpp (linhas 23 a 189). No arquivo de origem, o lugar do © tem o caractere de substituição U+FFFD (bytes EF BF BD); aqui vai o © correto.

```text
/*
 *                   The FreeType Project LICENSE
 *                   ----------------------------

 *                           2006-Jan-27

 *                   Copyright 1996-2002, 2006 by
 *         David Turner, Robert Wilhelm, and Werner Lemberg



 * Introduction
 * ============

 * The FreeType  Project is distributed in  several archive packages;
 * some of them may contain, in addition to the FreeType font engine,
 * various tools and  contributions which rely on, or  relate to, the
 * FreeType Project.

 * This  license applies  to all  files found  in such  packages, and
 * which do not  fall under their own explicit  license.  The license
 * affects  thus  the  FreeType   font  engine,  the  test  programs,
 * documentation and makefiles, at the very least.

 * This  license   was  inspired  by  the  BSD,   Artistic,  and  IJG
 * (Independent JPEG  Group) licenses, which  all encourage inclusion
 * and  use of  free  software in  commercial  and freeware  products
 * alike.  As a consequence, its main points are that:

 *   o We don't promise that this software works. However, we will be
 *     interested in any kind of bug reports. (`as is' distribution)

 *   o You can  use this software for whatever you  want, in parts or
 *      full form, without having to pay us. (`royalty-free' usage)

 *    o You may not pretend that  you wrote this software.  If you use
 *      it, or  only parts of it,  in a program,  you must acknowledge
 *     somewhere  in  your  documentation  that  you  have  used  the
 *     FreeType code. (`credits')

 * We  specifically  permit  and  encourage  the  inclusion  of  this
 * software, with  or without modifications,  in commercial products.
 * We  disclaim  all warranties  covering  The  FreeType Project  and
 * assume no liability related to The FreeType Project.


 *  Finally,  many  people  asked  us  for  a  preferred  form  for  a
 *  credit/disclaimer to use in compliance with this license.  We thus
 * encourage you to use the following text:

 *   """
 *    Portions of this software are copyright © <year> The FreeType
 *    Project (www.freetype.org).  All rights reserved.
 *   """

 *  Please replace <year> with the value from the FreeType version you
 *  actually use.

* Legal Terms
* ===========

* 0. Definitions
* --------------

*   Throughout this license,  the terms `package', `FreeType Project',
*   and  `FreeType  archive' refer  to  the  set  of files  originally
*   distributed  by the  authors  (David Turner,  Robert Wilhelm,  and
*   Werner Lemberg) as the `FreeType Project', be they named as alpha,
*   beta or final release.

*   `You' refers to  the licensee, or person using  the project, where
*   `using' is a generic term including compiling the project's source
*   code as  well as linking it  to form a  `program' or `executable'.
*   This  program is  referred to  as  `a program  using the  FreeType
*   engine'.

*   This  license applies  to all  files distributed  in  the original
*   FreeType  Project,   including  all  source   code,  binaries  and
*   documentation,  unless  otherwise  stated   in  the  file  in  its
*   original, unmodified form as  distributed in the original archive.
*   If you are  unsure whether or not a particular  file is covered by
*   this license, you must contact us to verify this.

*   The FreeType  Project is copyright (C) 1996-2000  by David Turner,
*   Robert Wilhelm, and Werner Lemberg.  All rights reserved except as
*   specified below.

* 1. No Warranty
* --------------

*   THE FREETYPE PROJECT  IS PROVIDED `AS IS' WITHOUT  WARRANTY OF ANY
*   KIND, EITHER  EXPRESS OR IMPLIED,  INCLUDING, BUT NOT  LIMITED TO,
*   WARRANTIES  OF  MERCHANTABILITY   AND  FITNESS  FOR  A  PARTICULAR
*   PURPOSE.  IN NO EVENT WILL ANY OF THE AUTHORS OR COPYRIGHT HOLDERS
*   BE LIABLE  FOR ANY DAMAGES CAUSED  BY THE USE OR  THE INABILITY TO
*   USE, OF THE FREETYPE PROJECT.

* 2. Redistribution
* -----------------

*   This  license  grants  a  worldwide, royalty-free,  perpetual  and
*   irrevocable right  and license to use,  execute, perform, compile,
*   display,  copy,   create  derivative  works   of,  distribute  and
*   sublicense the  FreeType Project (in  both source and  object code
*   forms)  and  derivative works  thereof  for  any  purpose; and  to
*   authorize others  to exercise  some or all  of the  rights granted
*   herein, subject to the following conditions:

*    o Redistribution of  source code  must retain this  license file
*      (`FTL.TXT') unaltered; any  additions, deletions or changes to
*      the original  files must be clearly  indicated in accompanying
*      documentation.   The  copyright   notices  of  the  unaltered,
*      original  files must  be  preserved in  all  copies of  source
*      files.

*    o Redistribution in binary form must provide a  disclaimer  that
*      states  that  the software is based in part of the work of the
*      FreeType Team,  in  the  distribution  documentation.  We also
*      encourage you to put an URL to the FreeType web page  in  your
*      documentation, though this isn't mandatory.

*  These conditions  apply to any  software derived from or  based on
*  the FreeType Project,  not just the unmodified files.   If you use
*  our work, you  must acknowledge us.  However, no  fee need be paid
*  to us.

* 3. Advertising
* --------------

*  Neither the  FreeType authors and  contributors nor you  shall use
*  the name of the  other for commercial, advertising, or promotional
*  purposes without specific prior written permission.

*  We suggest,  but do not require, that  you use one or  more of the
*  following phrases to refer  to this software in your documentation
*  or advertising  materials: `FreeType Project',  `FreeType Engine',
*  `FreeType library', or `FreeType Distribution'.

*  As  you have  not signed  this license,  you are  not  required to
*  accept  it.   However,  as  the FreeType  Project  is  copyrighted
*  material, only  this license, or  another one contracted  with the
*  authors, grants you  the right to use, distribute,  and modify it.
*  Therefore,  by  using,  distributing,  or modifying  the  FreeType
*  Project, you indicate that you understand and accept all the terms
*  of this license.

* 4. Contacts
* -----------

*  There are two mailing lists related to FreeType:

*    o freetype@nongnu.org

*      Discusses general use and applications of FreeType, as well as
*      future and  wanted additions to the  library and distribution.
*      If  you are looking  for support,  start in  this list  if you
*      haven't found anything to help you in the documentation.

*    o freetype-devel@nongnu.org

*      Discusses bugs,  as well  as engine internals,  design issues,
*      specific licenses, porting, etc.

*  Our home page can be found at

*    http://www.freetype.org
*/
```

### Interpolador de curvas do Lottie (MPL-2.0)

O arquivo `src/loaders/lottie/tvgLottieInterpolator.cpp` do ThorVG traz, depois da licença MIT do ThorVG, este aviso:

```text
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
```

Fonte desse arquivo, na versão compilada no `.wasm`: https://github.com/theashraf/thorvg/blob/019d18c7592ad6370059f647512b00be5f5f868e/src/loaders/lottie/tvgLottieInterpolator.cpp

Texto da Mozilla Public License 2.0 (fonte: https://www.mozilla.org/media/MPL/2.0/index.txt, sha256 `3f3d9e0024b1921b067d6f7f88deb4a60cbe7a78e76c64e3f1d7fc3b779b9d04`):

```text
Mozilla Public License Version 2.0
==================================

1. Definitions
--------------

1.1. "Contributor"
    means each individual or legal entity that creates, contributes to
    the creation of, or owns Covered Software.

1.2. "Contributor Version"
    means the combination of the Contributions of others (if any) used
    by a Contributor and that particular Contributor's Contribution.

1.3. "Contribution"
    means Covered Software of a particular Contributor.

1.4. "Covered Software"
    means Source Code Form to which the initial Contributor has attached
    the notice in Exhibit A, the Executable Form of such Source Code
    Form, and Modifications of such Source Code Form, in each case
    including portions thereof.

1.5. "Incompatible With Secondary Licenses"
    means

    (a) that the initial Contributor has attached the notice described
        in Exhibit B to the Covered Software; or

    (b) that the Covered Software was made available under the terms of
        version 1.1 or earlier of the License, but not also under the
        terms of a Secondary License.

1.6. "Executable Form"
    means any form of the work other than Source Code Form.

1.7. "Larger Work"
    means a work that combines Covered Software with other material, in
    a separate file or files, that is not Covered Software.

1.8. "License"
    means this document.

1.9. "Licensable"
    means having the right to grant, to the maximum extent possible,
    whether at the time of the initial grant or subsequently, any and
    all of the rights conveyed by this License.

1.10. "Modifications"
    means any of the following:

    (a) any file in Source Code Form that results from an addition to,
        deletion from, or modification of the contents of Covered
        Software; or

    (b) any new file in Source Code Form that contains any Covered
        Software.

1.11. "Patent Claims" of a Contributor
    means any patent claim(s), including without limitation, method,
    process, and apparatus claims, in any patent Licensable by such
    Contributor that would be infringed, but for the grant of the
    License, by the making, using, selling, offering for sale, having
    made, import, or transfer of either its Contributions or its
    Contributor Version.

1.12. "Secondary License"
    means either the GNU General Public License, Version 2.0, the GNU
    Lesser General Public License, Version 2.1, the GNU Affero General
    Public License, Version 3.0, or any later versions of those
    licenses.

1.13. "Source Code Form"
    means the form of the work preferred for making modifications.

1.14. "You" (or "Your")
    means an individual or a legal entity exercising rights under this
    License. For legal entities, "You" includes any entity that
    controls, is controlled by, or is under common control with You. For
    purposes of this definition, "control" means (a) the power, direct
    or indirect, to cause the direction or management of such entity,
    whether by contract or otherwise, or (b) ownership of more than
    fifty percent (50%) of the outstanding shares or beneficial
    ownership of such entity.

2. License Grants and Conditions
--------------------------------

2.1. Grants

Each Contributor hereby grants You a world-wide, royalty-free,
non-exclusive license:

(a) under intellectual property rights (other than patent or trademark)
    Licensable by such Contributor to use, reproduce, make available,
    modify, display, perform, distribute, and otherwise exploit its
    Contributions, either on an unmodified basis, with Modifications, or
    as part of a Larger Work; and

(b) under Patent Claims of such Contributor to make, use, sell, offer
    for sale, have made, import, and otherwise transfer either its
    Contributions or its Contributor Version.

2.2. Effective Date

The licenses granted in Section 2.1 with respect to any Contribution
become effective for each Contribution on the date the Contributor first
distributes such Contribution.

2.3. Limitations on Grant Scope

The licenses granted in this Section 2 are the only rights granted under
this License. No additional rights or licenses will be implied from the
distribution or licensing of Covered Software under this License.
Notwithstanding Section 2.1(b) above, no patent license is granted by a
Contributor:

(a) for any code that a Contributor has removed from Covered Software;
    or

(b) for infringements caused by: (i) Your and any other third party's
    modifications of Covered Software, or (ii) the combination of its
    Contributions with other software (except as part of its Contributor
    Version); or

(c) under Patent Claims infringed by Covered Software in the absence of
    its Contributions.

This License does not grant any rights in the trademarks, service marks,
or logos of any Contributor (except as may be necessary to comply with
the notice requirements in Section 3.4).

2.4. Subsequent Licenses

No Contributor makes additional grants as a result of Your choice to
distribute the Covered Software under a subsequent version of this
License (see Section 10.2) or under the terms of a Secondary License (if
permitted under the terms of Section 3.3).

2.5. Representation

Each Contributor represents that the Contributor believes its
Contributions are its original creation(s) or it has sufficient rights
to grant the rights to its Contributions conveyed by this License.

2.6. Fair Use

This License is not intended to limit any rights You have under
applicable copyright doctrines of fair use, fair dealing, or other
equivalents.

2.7. Conditions

Sections 3.1, 3.2, 3.3, and 3.4 are conditions of the licenses granted
in Section 2.1.

3. Responsibilities
-------------------

3.1. Distribution of Source Form

All distribution of Covered Software in Source Code Form, including any
Modifications that You create or to which You contribute, must be under
the terms of this License. You must inform recipients that the Source
Code Form of the Covered Software is governed by the terms of this
License, and how they can obtain a copy of this License. You may not
attempt to alter or restrict the recipients' rights in the Source Code
Form.

3.2. Distribution of Executable Form

If You distribute Covered Software in Executable Form then:

(a) such Covered Software must also be made available in Source Code
    Form, as described in Section 3.1, and You must inform recipients of
    the Executable Form how they can obtain a copy of such Source Code
    Form by reasonable means in a timely manner, at a charge no more
    than the cost of distribution to the recipient; and

(b) You may distribute such Executable Form under the terms of this
    License, or sublicense it under different terms, provided that the
    license for the Executable Form does not attempt to limit or alter
    the recipients' rights in the Source Code Form under this License.

3.3. Distribution of a Larger Work

You may create and distribute a Larger Work under terms of Your choice,
provided that You also comply with the requirements of this License for
the Covered Software. If the Larger Work is a combination of Covered
Software with a work governed by one or more Secondary Licenses, and the
Covered Software is not Incompatible With Secondary Licenses, this
License permits You to additionally distribute such Covered Software
under the terms of such Secondary License(s), so that the recipient of
the Larger Work may, at their option, further distribute the Covered
Software under the terms of either this License or such Secondary
License(s).

3.4. Notices

You may not remove or alter the substance of any license notices
(including copyright notices, patent notices, disclaimers of warranty,
or limitations of liability) contained within the Source Code Form of
the Covered Software, except that You may alter any license notices to
the extent required to remedy known factual inaccuracies.

3.5. Application of Additional Terms

You may choose to offer, and to charge a fee for, warranty, support,
indemnity or liability obligations to one or more recipients of Covered
Software. However, You may do so only on Your own behalf, and not on
behalf of any Contributor. You must make it absolutely clear that any
such warranty, support, indemnity, or liability obligation is offered by
You alone, and You hereby agree to indemnify every Contributor for any
liability incurred by such Contributor as a result of warranty, support,
indemnity or liability terms You offer. You may include additional
disclaimers of warranty and limitations of liability specific to any
jurisdiction.

4. Inability to Comply Due to Statute or Regulation
---------------------------------------------------

If it is impossible for You to comply with any of the terms of this
License with respect to some or all of the Covered Software due to
statute, judicial order, or regulation then You must: (a) comply with
the terms of this License to the maximum extent possible; and (b)
describe the limitations and the code they affect. Such description must
be placed in a text file included with all distributions of the Covered
Software under this License. Except to the extent prohibited by statute
or regulation, such description must be sufficiently detailed for a
recipient of ordinary skill to be able to understand it.

5. Termination
--------------

5.1. The rights granted under this License will terminate automatically
if You fail to comply with any of its terms. However, if You become
compliant, then the rights granted under this License from a particular
Contributor are reinstated (a) provisionally, unless and until such
Contributor explicitly and finally terminates Your grants, and (b) on an
ongoing basis, if such Contributor fails to notify You of the
non-compliance by some reasonable means prior to 60 days after You have
come back into compliance. Moreover, Your grants from a particular
Contributor are reinstated on an ongoing basis if such Contributor
notifies You of the non-compliance by some reasonable means, this is the
first time You have received notice of non-compliance with this License
from such Contributor, and You become compliant prior to 30 days after
Your receipt of the notice.

5.2. If You initiate litigation against any entity by asserting a patent
infringement claim (excluding declaratory judgment actions,
counter-claims, and cross-claims) alleging that a Contributor Version
directly or indirectly infringes any patent, then the rights granted to
You by any and all Contributors for the Covered Software under Section
2.1 of this License shall terminate.

5.3. In the event of termination under Sections 5.1 or 5.2 above, all
end user license agreements (excluding distributors and resellers) which
have been validly granted by You or Your distributors under this License
prior to termination shall survive termination.

************************************************************************
*                                                                      *
*  6. Disclaimer of Warranty                                           *
*  -------------------------                                           *
*                                                                      *
*  Covered Software is provided under this License on an "as is"       *
*  basis, without warranty of any kind, either expressed, implied, or  *
*  statutory, including, without limitation, warranties that the       *
*  Covered Software is free of defects, merchantable, fit for a        *
*  particular purpose or non-infringing. The entire risk as to the     *
*  quality and performance of the Covered Software is with You.        *
*  Should any Covered Software prove defective in any respect, You     *
*  (not any Contributor) assume the cost of any necessary servicing,   *
*  repair, or correction. This disclaimer of warranty constitutes an   *
*  essential part of this License. No use of any Covered Software is   *
*  authorized under this License except under this disclaimer.         *
*                                                                      *
************************************************************************

************************************************************************
*                                                                      *
*  7. Limitation of Liability                                          *
*  --------------------------                                          *
*                                                                      *
*  Under no circumstances and under no legal theory, whether tort      *
*  (including negligence), contract, or otherwise, shall any           *
*  Contributor, or anyone who distributes Covered Software as          *
*  permitted above, be liable to You for any direct, indirect,         *
*  special, incidental, or consequential damages of any character      *
*  including, without limitation, damages for lost profits, loss of    *
*  goodwill, work stoppage, computer failure or malfunction, or any    *
*  and all other commercial damages or losses, even if such party      *
*  shall have been informed of the possibility of such damages. This   *
*  limitation of liability shall not apply to liability for death or   *
*  personal injury resulting from such party's negligence to the       *
*  extent applicable law prohibits such limitation. Some               *
*  jurisdictions do not allow the exclusion or limitation of           *
*  incidental or consequential damages, so this exclusion and          *
*  limitation may not apply to You.                                    *
*                                                                      *
************************************************************************

8. Litigation
-------------

Any litigation relating to this License may be brought only in the
courts of a jurisdiction where the defendant maintains its principal
place of business and such litigation shall be governed by laws of that
jurisdiction, without reference to its conflict-of-law provisions.
Nothing in this Section shall prevent a party's ability to bring
cross-claims or counter-claims.

9. Miscellaneous
----------------

This License represents the complete agreement concerning the subject
matter hereof. If any provision of this License is held to be
unenforceable, such provision shall be reformed only to the extent
necessary to make it enforceable. Any law or regulation which provides
that the language of a contract shall be construed against the drafter
shall not be used to construe this License against a Contributor.

10. Versions of the License
---------------------------

10.1. New Versions

Mozilla Foundation is the license steward. Except as provided in Section
10.3, no one other than the license steward has the right to modify or
publish new versions of this License. Each version will be given a
distinguishing version number.

10.2. Effect of New Versions

You may distribute the Covered Software under the terms of the version
of the License under which You originally received the Covered Software,
or under the terms of any subsequent version published by the license
steward.

10.3. Modified Versions

If you create software not governed by this License, and you want to
create a new license for such software, you may create and use a
modified version of this License if you rename the license and remove
any references to the name of the license steward (except to note that
such modified license differs from this License).

10.4. Distributing Source Code Form that is Incompatible With Secondary
Licenses

If You choose to distribute Source Code Form that is Incompatible With
Secondary Licenses under the terms of this version of the License, the
notice described in Exhibit B of this License must be attached.

Exhibit A - Source Code Form License Notice
-------------------------------------------

  This Source Code Form is subject to the terms of the Mozilla Public
  License, v. 2.0. If a copy of the MPL was not distributed with this
  file, You can obtain one at https://mozilla.org/MPL/2.0/.

If it is not possible or desirable to put the notice in a particular
file, then You may include the notice in a location (such as a LICENSE
file in a relevant directory) where a recipient would be likely to look
for such a notice.

You may add additional accurate notices of copyright ownership.

Exhibit B - "Incompatible With Secondary Licenses" Notice
---------------------------------------------------------

  This Source Code Form is "Incompatible With Secondary Licenses", as
  defined by the Mozilla Public License, v. 2.0.
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

Na mesma pasta, `uri.h` traz também `(C) Copyright IBM Corporation 2021`, sob a mesma licença MIT. `msinttypes/` (Alexander Chemeris, BSD-3-Clause) só é incluído com o MSVC anterior ao Visual Studio 2013 (`rapidjson.h`, linha 197) e não entra no `.wasm`, feito com clang.

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

### Errol (MIT), dentro do JerryScript

Fonte: cabeçalho de https://github.com/theashraf/thorvg/blob/019d18c7592ad6370059f647512b00be5f5f868e/src/loaders/lottie/jerryscript/jerry-core/ecma/base/ecma-helpers-errol.cpp (linhas 15 a 36).

```text
 * This file is based on work under the following copyright and permission
 * notice:
 *
 *   Copyright (c) 2016 Marc Andrysco
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy
 *   of this software and associated documentation files (the "Software"), to deal
 *   in the Software without restriction, including without limitation the rights
 *   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *   copies of the Software, and to permit persons to whom the Software is
 *   furnished to do so, subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in all
 *   copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 *   SOFTWARE.
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

O `src/strtol.rs` do crate diz `Original code from the c-ward project. Licensed under the MIT license.`, mas o `LICENCES.md` acima não traz o texto do c-ward.

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
