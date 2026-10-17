# The user's verdicts

What this user has actually said about films made for them (2026-09-28 → 2026-09-30), with context. Read it before you choose an idea. These are reactions to specific films, not universal rules; generalise them only as far as their context goes. When the user reacts to a new film, append an entry: date, film, quote, what they reacted to, and the narrowest lesson it supports.

## Rejected
- **Slide/PPT layouts are the strongest dislike.** "This looks like a PPT, there is a text on left side, it's in structured." "Clear AI slop… the header, the footer, the text in left side, it is like presentation, it's like slides." Reacting to: header bars with product/version/year, left headline + grey subtitle, kicker above a headline, terracotta hairline, footer CTA with arrow circle.
- **"Still slop, not perfect"**: a big claim on an empty flat ivory field, underline wipe, long holds, ivory/coral "editorial" palette.
- **Copying the example instead of the brand.** "It was just an example. Don't just take the reference from my site… its brand colour is orange, so it should put orange." The look comes from the subject's brand.
- **Copying one reference.** "The goal is not to copy/steal the recreation… take typography from this, gradient from another, effect from another… make something unique."
- **Too sparse.** "It should have more stuff than this, but it should use the animations, the fonts, the logos." Type alone on an empty ground was not enough; they wanted layered product, object and logo motion. (Richness ≠ clutter: see the calm-film pick below.)
- **Vibe-coded objects**: a "patch" drawn as a flat rounded yellow card with a dashed CSS-stitch corner was called slop; so was a dark rounded "Good morning / ● Rent in 3 days · $1,450" card. Objects and UI need real identity, not generic web-component styling.

## Preferred
- Films where every joint had a physical cause (a click floods the frame, a caret becomes a number, the camera dives through a decimal) beat films of repeating cards.
- A film where one small motif carried through every beat of a specific, funny problem ("very good").
- Richer surfaces (photographic plates, a paper ground, a 3D object, real shutter blur) and designed sound (sectioned music, SFX, VO at −14 LUFS) beat flat-vector, silent versions: "Left is better in everyone."
- In one round the user picked a calm, legible film over a frantic, constantly moving one. Energy is not the goal; the right energy for the brand is.
- The user's standing goal: films that look "like an actual motion designer made them, like the references", killing AI slop without boxing the model's own creativity in.

---

## Added 2026-10-05 (motionmaxxing v2)

### Rejected
- **The v1 Wispr Flow film (motionmaxxing v1 test).** User-reported frame: tracked caps `WISPR FLOW` top-left, a chapter counter `02 / SPEAK` top-right, a left-aligned headline on a flat dark ground. It is a slide/HUD template, the same anatomy as the three slop films the user rejected earlier (SuperX reel, "Claude motion reel", "muda": corner name, running counter or timecode, BPM/FPS text, left headline, card on a swatch). Caveat: an autopsy could not find that exact frame in `film/final.mp4` (19.5 s), only its near-twin in the rejected "muda" film; treat the frame as the user's report and the film's other faults as measured. What the same film did, and why each is a fail:
  - Page chrome of any kind (brand label, counter, timecode, metadata, progress hairline) is not rescued by a reason. v1's law text said nothing about it, so the agent shipped label chips ("Messages", "Mail", "Editor") on every shot.
  - Five flat swatch grounds in 19 s (cream, ink, cream, lavender, green) is a deck. v1 had prescribed "ground = brand's darkest or lightest surface, flipped by act". 0 of 9 captured media/screens were used.
  - A 7 s hold on one generic rounded composer card (invented sender names, invented subject lines) is vibe-coded UI, 36% of the film.
  - Headline typed letter by letter with a caret on an empty field: the rule (typing is for the product's input only) was clear and was rationalised away.
  - A stat slide (centred 440 px "4x" over a small label) and a web-footer end card (logo, button, cursor).
  - A pill pinned at one coordinate through five shots reads as a footer dock, not a carrier.
  - 0.9 s of unchanged picture while a card waited; no NOTE.md was written, so nothing was self-reported.
  - Lesson for v2: chrome, deck layouts and swatch grounds are mechanical fails (G5, "Never ship"); the picture is built from the captured material; every delivery has NOTE.md with measured numbers.

### Self-reported, not a user verdict
- **Resend v1 test (a private test run).** The agent's own NOTE.md named the weakest spots: the emptiest stretch is a single small "Email"; the delivered card was 0.33 W for a 0.8 s read; two panels at 0.43 W; the music loop restarted; the end card ran about 5 s. That is the "small card on a void" failure (cf. the dark card on near-black the user called "vibe-coded" in the Kiln round, and the "too sparse" verdict above) and the "6 s static end card read as 'the film gave up'" lesson from the Astra round (see `edits.md`). No user reaction is stored. Lessons: a proof object is magnified by the camera or cropped by the frame, it sits in a lit, textured world, and the end card holds 0.6-1.4 s.

### Picks stored in the evals (for calibration; single rater)
- 09-29 sonnet-55: killing page chrome beat an ivory serif editorial with chrome and bar charts ("L is better").
- 09-30 spotify: one carried motif and a real material beat a left headline + phone; of three builds the one with real cover art won ("C is very good").
- 09-30 five invented brands, two models: 9 of 10 picks were with-skill; the one exception was a calm, legible film over a frantic one.
- 09-30 v2 (rich surfaces, designed sound) over v1 on all three reels: "Left is better in everyone."
- **Pending:** the 10-02 motion-eye A/B results (Spotify, OpenAI Dots) have no stored user pick. Ask before citing a winner; append it here when the user states it.

### Standing instruction for appending
Date, film, quote, what they reacted to, narrowest lesson. Do not generalise beyond the film's context.

---

## Added 2026-10-13 (this machine's user, Jose; Swipes)

### Rejected
- **A voice-over that sounds read (Swipes commercial, "telas reais" rev. 2, 1min26s; ElevenLabs "Roberta", multilingual v2, stability .45, style .15, one request per scene).** "No vídeo comercial telas reais a entonação da voz/fala não está adequada, precisa melhorar." Reacting to: the narration, on a film whose picture and timing he had already approved. He named no line. Measured afterwards: the impact lines did not land (pitch stayed level at the end of the brand line, of "E não é protótipo.", of the product name said alone and of the tagline), the three-gesture sequence ran at 7 to 8 syllables per second with 0.06 to 0.15 s between sentences, and the emphasis fell on function words.
  - Narrowest lesson: for this user a read that sounds read is a rejection on its own. The agent cannot hear, so the read is checked by measurement before any picture is built (`scripts/entonacao.mjs`), and the user is told nobody listened.
  - Context: that film was built with the code pipeline in the Swipes repo, not with this skill's runtime, but with the same VO approach and nearly the same settings as `voice.py vo` had by default (.5 / 0).
  - His verdict on the corrected read (rev. 3, same day): **"Melhorou sim."** The three changes that carried it: the script sent as paragraphs instead of single sentences, stability .25 to .3 with style .3 to .4, and pauses fixed in the audio. He did not ask for another pass on the voice.

### Preferred
- **The corrected read above** ("Melhorou sim", 2026-10-13).

### Content calls on the same film (2026-10-13)
- **Cut the defensive proof beat.** "Pode remover a parte que cita que não é protótipo e tal." Reacting to: a whole scene built on "E não é protótipo. Está em produção...". Narrowest lesson: for this product he does not want the film to answer an objection nobody raised; a claim stated as a denial reads as doubt.
- **Name the ERPs.** "Dá uma ênfase que integra aos principais ERPs do mercado, TOTVS Protheus, Datasul, SAP entre outros." Reacting to: an integration scene that said only "conecta direto ao ERP". He wants the breadth named, on screen and in the voice. Only the Protheus integration exists today; offered three wordings, he chose "feito para os principais ERPs do mercado" over "integra". Lesson: when a claim runs ahead of the product, say so once, offer a true wording next to the literal one, and build what he picks.
- **Final call on that film (rev. 4, 2026-10-13):** "Esse ficou quase 100%, mas podemos manter assim." He did not say what the missing part was and asked for no further pass. Read it as: approved to ship as is, not as "perfect"; do not reopen it unprompted.

### Content calls for rev. 5 of the same film (2026-10-13, after "quase 100%")
- **Open on the logo in motion.** "Abertura: abrir com o logo em movimento." Reacting to: a film that opened straight on the problem scene and showed the brand only at 0:10. Narrowest lesson: for this user's product commercial the brand comes first, as a short moving sting (built as 2.7 s, no voice, the mark swiped off like the product's own card), then the hook.
- **Say "conecta com os principais ERPs", with no names.** "Deixa só principais ERPs, mas não mencione o nome deles" and "falem que ele conecta com os principais ERPs, não que foi feito pra eles." Reacting to: rev. 4, which he had asked for one round earlier with the three vendor names in voice and on screen. Lesson: he wanted the breadth, then decided against naming third parties; a category claim ("os principais ERPs do mercado") in an active verb ("conecta") is his final wording. Do not put other companies' product names in his films unless he asks again.
- **"Roda em qualquer dispositivo", not "instala direto no celular".** "Tira a parte que fala que instala direto no celular, mencione que roda em qualquer dispositivo." Lesson: the sign-off sells reach (phone, tablet, computer), not the install mechanism.
- Process note: each of these changed one sentence. Only the changed sentence was generated and spliced at a sentence pause next to the approved read; four candidate takes were measured for the new claim line and the one that landed (falling end, peak on "principais") was kept.

### Verdict on rev. 5 and the call for rev. 6 (2026-10-13, late)
- **"Muito bom mesmo!"** (a third party the user showed rev. 5 to; the user's own note to them: "melhorou muito"). The logo sting up front, the generic ERP claim and the any-device sign-off all stood.
- **Plain words over jargon.** "Vamos trocar o termo ERP por Sistema / Sistemas. ERP tá muito complexo para leigos." and "Último ajuste é tirar Protheus daqui" (pointing at a real app screen used as a card, whose header named the vendor product). Reacting to: "ERP" in the voice, in two headlines, in a diagram node, and vendor names inside screenshots of the real product. Narrowest lesson: for this product's commercial the audience is lay; say "sistema", never the category acronym, and no vendor product name anywhere in frame, including inside real screenshots. Built by swapping the term in the rendered DOM before photographing the app (documented as the one thing the capture changes), and by regenerating only the three spoken sentences that carried the word.
- The user offered an external video-generation AI "se necessário". It was not needed and no key for it exists on this machine: a terminology change is a re-voice of three sentences plus text and re-capture, and the approved voice has to stay the same voice.

---

## Added 2026-10-13 (SM STORE, Reels 9:16 "cores neutras", v1)

### Rejected
- **"ficou muito curto e muito simples, revise e coloque uma narração"** (user, 13/10/2026). Reacting to: a 13,5 s Reels for a fashion store built from 15 real product photos: one sentence with a slot ("Aquela loja que vende ___") over full-bleed photos, match cuts between three colours, a 2 s montage, one composite hero frame, coupon, logo on a plain wall. No voice (no ElevenLabs key had been found), a code-synthesised score, mean motion 2.9 on the look.py scale (below the human band).
  - Narrowest lesson: for a store commercial in Reels format this user expects a fuller film: more length, more distinct scenes and devices, and a narrator. One typographic device repeated over stills with slow camera drift read as "simple", even with every gate passing.
  - The agent's interpretation (not the user's words): the film had one idea and one layout for 12 of 13 seconds; a calm motion number plus stills-only footage plus no voice is the "too sparse" verdict again in a different costume. Passing G0-G5 said nothing about this.
  - Also: the ElevenLabs key lives in a `.env` file; look for it before declaring "no voice".

### SM STORE Reels v2 (29 s, narrated), 2026-10-13
- **"precisa ajustar as falas, ela fala como se não tivesse pontuação. use a skill novamente e crie um video um pouco mais longo"** (user). Reacting to: the half-resolution preview of v2 (ElevenLabs "Roberta", multilingual v2, stability .30, style .30, speed .93 to 1.05; whole script in one request, nine lines, each line cut from the best of four takes by `entonacao.mjs` and placed with 0.5 to 1.3 s between lines). He did not object to the picture, the wall of real videos or the structure; he asked for a slightly longer film.
  - Narrowest lesson: for this user the pauses INSIDE a line matter as much as the ones between lines. Lines with commas ("Tem conjunto, cropped, wide leg, e novidade toda semana.", "Quem aí ama um desconto? Usa o cupom primeira compra.") were read straight through. `entonacao.mjs` only alerts on pauses between lines, so the take passed the measurement and still failed the ear.
  - The agent's interpretation: write one short sentence per line (a full stop where a comma would do), measure the gap after every comma, colon, question mark and full stop from the word timings, and enforce a minimum silence at each one in the generated audio before building any picture. 29 s was read as still short for a store commercial.

---

## Added 2026-10-13 (Swipes "22% acima", first film made with the skill on this machine, 16:9 then 9:16)

### Rejected
- **"parece que ficou o zoom do modo vertical dentro do modo wide, está errado, crie no formato vertical para postar no instagram"** (user, 13/10/2026). Reacting to: a 25 s UI documentary of one task (a purchase order 22 percent above the company's own history, rejected with a swipe), 1920x1080, real captures of a phone app with the camera always inside the screen at macro scale, selective focus on the phrase that matters. G0, G2, G3 and G5 all passed.
  - Narrowest lesson: a phone app shown as tight crops inside a landscape frame reads to this user as the wrong format, not as a macro style. For Instagram he wants 9:16.
  - The agent's interpretation (not the user's words): the format was never asked. 16:9 was taken from the skill's default and from the previous videos of the same project. The destination decides the frame before any idea does.

### Delivered after the correction, no reaction yet
- 1080x1920 version of the same film: app at full frame width, whole app on frame 0, push-ins only on the price and on "+22,0% acima". look.py on the final: G0 PASS, G2 PASS, G3 PASS (end hold 0.97 s after a first render that failed at 2.00 s), motion 1.8 (below the human band). Nobody has listened to the audio. The user has not said yet whether the skill stays.

### Process note from the same session
- The user declined, mid-work and without comment, the creation of a helper script for the chunked render. The commands went into the film's LEIA-ME instead.

---

## Added 2026-10-13 (standing instruction on delivery, Jose)

- **"ahh e não precisa criar duas versoes a leve e a final, cria apenas a versão da melhor resolução, o que é bom criar sempre é a versão 9:16 e 16:9, ou seja formato reels e formato youtube, verticar e horizontal"** (user, 13/10/2026). Said while reviewing the skill itself, not in reaction to one film. He gave no reason.
  - Narrowest lesson: no half-resolution draft next to the final; each film is rendered once per format at full size, and every film is delivered in both 9:16 (Reels) and 16:9 (YouTube).
  - The agent's interpretation (not the user's words): "melhor resolução" is read as full size (1080x1920 and 1920x1080), not 4K. The two formats are the same film with the same sound and cut times, each framed for its own shape. The 16:9 of a phone app is not the vertical framing with zoom, which he rejected on the same day (entry above); how a 16:9 of a phone app should look has no verdict yet.
  - Where it lives in the steps: `SKILL.md`, local note, item "Entrega", and steps 6 to 9.

---

## Added 2026-10-13 (Conplan, Reels 9:16 "a conversa continua": a WhatsApp conversation on a phone, narrated)

Recorded the same night, from the film's own `NOTE.md` (`conteudo/reels-conplan-suporte-whatsapp-2026-10-13/` in the Conplan workspace). These two verdicts had been left out of this file when they were given.

### Rejected
- **"revise o áudio, não ficou adequado; o zoom ficou muito forte"** (user, 13/10/2026, on v1, 22 s). Reacting to: a phone conversation with the camera going macro on the read ticks (4x) and pushing 1.6x on the main sentence; narration by "Roberta", a generated score, UI sounds. G0, G2, G3 and G5 had passed. He did not say what was wrong with the audio.
  - Measured afterwards (the agent's findings, not his words): the narration was cut in the wrong place (the "Na" of "Na Conplan" sat at the end of the previous sentence, with a pause in the middle), found only when the final mix was transcribed; the sentences were 5 dB apart; the music went down and up 9 dB at every sentence; 114 sound effects in 22 s, 95 of them keyboard clicks.
  - Narrowest lesson: a strong push-in on a phone screen is a rejection for this user in vertical too. It is his second verdict about zoom on the same day (the first was the Swipes film in 16:9).
  - What he raised no further objection to (v2): the device in frame almost the whole film (base 0.90), at most 1.20 on the main sentence (1.34x the base), slow moves; every sentence at the same level; the music at one level from start to end; 17 quiet effects.
  - The agent's interpretation (not the user's words): which of the four audio changes he had heard is unknown. All four are now measured on the delivered file (`scripts/ouvir.py`, S1 to S4) and the camera on the HTML (`scripts/camera.mjs`, Z1 and Z2).
- **"ainda acho que não ficou perfeito, a sincronização quando mostra a msg e a fala, poderia mudar a copy e deixar melhor?"** (user, same day, on v2). Reacting to: a narrator telling the story over the conversation ("Incluir um dependente. Entender o reajuste...") while the balloons showed other sentences, at other instants. The balloons followed the bars of the music and the narration had been fitted in afterwards.
  - Narrowest lesson: when there is text on screen and a voice, he wants the two to say the same thing at the same time. He asked for the copy itself to change to make that possible.
  - Delivered after it (v3, no reaction recorded yet): each spoken line has its own balloon with the same words, in question and answer pairs ("Quer incluir um dependente?" in the voice, "Quero incluir meu bebê no plano" on screen; "A gente cuida." and "A gente cuida da inclusão"); the narration recorded first and the film's frames computed from it; each balloon entering 0.03 to 0.14 s before its line, measured by transcription.

### What the gates said about this user's rejections (count on 2026-10-13)
- Six rejections so far: the read (Swipes commercial), "curto e simples" with no narrator (SM STORE v1), no pauses at punctuation (SM STORE v2), the wrong format with a macro camera (Swipes 16:9), audio and zoom (this Reels v1), voice and screen out of step (this Reels v2). Every one of those films had passed G0-G5. Four involved sound, two the camera (the Reels v1 both), and one was length and simplicity.
- In one of them the rule already existed in `references/` and was not followed: "never one tick per character" and "wall-to-wall hits are a tell" (`sound-sync.md`) against 114 effects, 95 of them key clicks. In another the skill's own default was the problem (1920x1080 for a phone app). Written rules did not prevent either; each fix that held was a script that prints a number (`entonacao.mjs`, the transcription of the mix). Hence the local gates Z1, Z2, S1 to S4.
- Not covered by any gate: "muito curto e muito simples". That one is still judgment (length, number of distinct scenes and devices, a narrator), to be decided in the storyboard.

---

## Added 2026-10-13 (SM STORE Reels v3, 41.8 s, narrated; then v4 in 9:16 and 16:9)

### Rejected
- **"precisamos usar a skill motionmaxxing para melhorar esse video que está com a fala atropelada e com discordancia, qnd fala wide leg mostra uma causa diferente do modelo, etc."** and, a minute later, **"faça uma revisçao geral e se necessário pode usar a api do higgsfield tbm"** (user, 13/10/2026). Reacting to: v3, the version built to fix "ela fala como se não tivesse pontuação". Its narration was 17 one-sentence lines ("Off white." "Marrom." "Tem cropped.") cut from five takes, with 0.30 s of silence inserted at every comma and loudness matched line by line; it had passed `entonacao.mjs`. Its picture showed a black flare set on "tem wide leg" and the wide-leg jeans on "tem cropped".
  - Narrowest lesson: for this user the picture and the on-screen words must agree with the voice at the moment it speaks. A named garment shows that garment; a mismatch is a rejection on its own.
  - Narrowest lesson on the voice: the cure for "no punctuation" (v2) overshot. A read assembled from fragments, with silences cut into running speech, was heard as "atropelada".
  - What the autopsy measured (the agent's findings, not the user's words): 22 SFX, several on spoken words (a tick at -7 dB on each colour name); the on-screen slot cycling "off white / marrom / preto" while the voice said "aquela loja que vende"; singular in the voice and plural on screen; "156 mil" on screen against "mais de 150 mil" spoken; a headline left up for 10 s over two later sentences; an unspoken ribbon; the price digits and two headline words hidden behind her head; "Sabe" (você) next to "usa o cupom" (tu).
  - The agent's interpretation: "discordância" was read as both the grammar and the speech/picture mismatch, and both were fixed. He named one example and wrote "etc.", so the rest of the list above is the agent's audit.
  - What was built (v4), no reaction yet: 11 whole sentences; enumeration pauses requested from the TTS itself with `<break time="0.35s" />` (words lengthen before the pause and "preto" finally falls, -5.3 st), no silence spliced inside a sentence; sentences taken from three takes and swapped only at 0.6 to 1.0 s pauses; every on-screen word lands on its spoken frame and nothing unspoken stays up; all text above her head; 8 whooshes, each inside a gap between sentences; music as a fixed bed 17 dB under the voice. `entonacao.mjs` on the assembled read: no alert, 14 marks, 0 without pause. Nobody listened.
  - Higgsfield was offered "se necessário" and not used: every line of the script already had real footage of the store. The user has not commented on that call.
  - Note for `SKILL.md`'s local rule "pausa se acerta no som já gerado, não com marca de pausa no texto": on this film the opposite measured better for enumerations. One of eight takes with break tags had a stray sound between two items (confirmed in the audio), and the transcript of another suggests the same: check each pause for audio before using a take.

### Process
- **"pq tanta demora?"** (user, same session, about three and a half hours in). The agent had rendered the vertical twice (the first render passed the gates but had a 2.13 s near-still stretch) and the horizontal once, about 20 minutes per format in six foreground parts, on a machine with 1.4 to 2.1 GB of free memory shared with other sessions. Narrowest lesson: say at the start how long the renders will take, and settle stillness by stills and a short part before the first full render.

---

## Added 2026-10-14 (Rocha Digital Studio presentation, v2 "Aberto.", 40.0 s, 16:9 delivered, 9:16 stopped mid-render)

### Rejected
- **"a primeira versão ficou muito melhor que essa."** (user, 14/10/2026, a few minutes after receiving `final-16x9.mp4`; he had asked "onde esta o video finalizado?" just before). Reacting to: the alternative presentation film he had requested with "crie uma versão nova alternativa usando a nova versão da skill motionmaxxing e agora temos tbm a api do higgsfiel no .env para explorar". v2 is one locked-off AI-generated shop facade (Higgsfield Soul Cinema still, Kling O3 clips) from dusk to dawn, with the real client sites, the real landing page and the real site chat composited on the steel shutter as a lit screen; narrated, 40 s. v1 (same day, `conteudo/video-apresentacao-rocha-20261013/`) is an interface documentary: a wall of ten real client screens, BUILD. GROW. AUTOMATE. as chapters, cursors arriving at the real form, the CRM panel filling itself, a pull-back to the hexagon ring "Um estúdio.".
  - He gave no reason. Everything below is the agent's autopsy, not his words.
  - Narrowest lesson that is safe to draw: for this brand's presentation he prefers the film made of the brand's own interface and work over an atmospheric film staged in a generated place. A generated location as the main stage did not beat real screens.
  - What the numbers already said and the agent let through: `look.py` printed mean frame-to-frame luma change 2.7/255 for v2, "below the human band" (median 6.8, IQR 4.4-9.8); v1 measured 4.7, inside the band. The agent answered the question with "the locked-off form is deliberate" and shipped. Both films passed G0, G2, G3 and G5, and v2 passed S1 to S4. Seventh rejection of a film that had passed every gate.
  - What v2 shows less of (the original brief of v1 was "apresentação da rocha digital studio e tudo o que realizamos"): seven sites for half a second each, seen through a slat texture in the wide shots; no panel, no data, no ring; nine seconds on one chat answer. v1 shows ten screens large, the form, the qualification panel and the ring.
  - Look: v2 is a dark violet night for 27 of its 40 seconds; v1 is the site's own dark interface with bright real pages in it.
  - The agent's own pre-build note in the storyboard had named the weakness ("'seu site não fecha' é uma premissa comum da categoria") and built it anyway.
  - Higgsfield: explored as asked (76.9 credits, about US$ 4.81). What it produced well (a locked-off plate that changes with time, a logo animated between two real frames) did not make the film better than the one with no generated image.

### Process
- The 9:16 of v2 was three parts into a 17-part render when the verdict arrived; the agent stopped it rather than spend 35 more minutes of a memory-starved machine on a version judged worse. Nothing was deleted.
- Lesson for the storyboard step: when the request is an "alternative version" of a film the user already has, show him the idea and two or three stills before generating plates and rendering 40 s. Here the first thing he saw of v2 was the finished 16:9, about four hours in.
- Lesson on the motion number: when `look.py` puts a film below the human band and the user has already rejected a film as "muito curto e muito simples", treat it as a fail to fix at the stills stage, not as a question to answer in the note.

---

## Added 2026-10-14 (Conplan, Amil Black, Demand Gen ad series, v1 of the 30 s vertical)

### Rejected
- **"eu vi um video ja e achei que ficou muito simples, precisamos usar o motion e deixar um video profissional e que prende a atenção. se necessário use a api higgsfield"** (user, 14/10/2026). Reacting to: the first render of a 27 s 9:16 ad (it came out 811 of 814 frames because the audio join used -shortest). Still photos from the operator's manual with a slow push (1.00 to 1.07), words rising one by one in sync with the voice, a dark blurred-photo ground for the hero number ("50%"), the real landing-page quote card tapped on "Toque", the logo on a dark ground. G0 and G2 passed; G3 failed (2.1 s end hold); mean motion 0.8/255, far below the human band. The voice, the sync and the content were not mentioned.
  - Narrowest lesson: for this user's paid-ad films, still photos with a slow push plus word-by-word captions read as "simple", the same verdict as SM STORE v1 ("muito curto e muito simples"). A motion number far below the band is a warning to act on before rendering, not a note.
  - He authorised generated footage (Higgsfield) "se necessário". The agent's reading: the picture has to move by itself (footage, not stills), with designed transitions, counters and a richer hero, while the camera stays contained (his zoom verdicts of 13/10 still stand).

### Preferred (same series, v2, 14/10/2026)
- **"que lindo"** — Bruno Moro and Sonia Marabin (the client's directors), each replying on the WhatsApp group at 11:53 to the 26 s 9:16 v2 (theme 1, "campanha de outubro") that the user forwarded. The user's own reaction to v2 was "só a entonação qnd ela fala corretora que fica estranho, mas está até aceitável", then "o video que ela fala urgencia e emergencia ela ta engasgando" (theme 3). Both lines were re-voiced; picture unchanged.
  - Narrowest lesson: for this client's ads, moving footage generated from the operator's own stills (Higgsfield image-to-video), short cuts with a light streak, counting hero numbers and the real CTA card tapped landed where stills with a slow push did not. Remaining complaints were about the read of single words, caught by ear, not by the gates (the "engasgo" passed S1/S2: a 0.24 s gap after a one-letter word sits under the S2 threshold).

---

## Added 2026-10-14 (Ramires, "Roberta, do balcão à produção", 66 s, 9:16 and 16:9)

### Rejected
- **"não é esse tipo de vídeo que eu pedi, eu quero um vídeo tutorial ensinando a usar o chat e não um comercial"** (user, 14/10/2026). The request had been: "crie um vídeo de demonstração (...) para eu apresentar para a Patrícia de como a Roberta pode trabalhar, mostre alguns exemplos nesse vídeo tutorial dinâmico e com narração". Reacting to: a narrated product film with a story arc (opening on the store's wall logo, one real order carried from the counter to production, the assistant speaking in the first person to the owner, a proposal for a future feature, a sign-off "Roberta. Do balcão à produção."). Every gate had passed (G0-G5, Z1-Z2, S1-S4); motion 1.9 and 1.4.
  - Narrowest lesson: when this user writes "tutorial", he means an instructional how-to of the product as it exists: steps, where to tap, what to type, what comes back, in the order a new user needs them. "Demonstração" plus "tutorial" was read by the agent as a sales demo; the word "tutorial" decides the genre.
  - The agent's interpretation (not the user's words): the idea step of the skill (find an idea only this brand could own, story, hero moment) pulled the film toward a commercial. For a tutorial the "idea" is the curriculum: each beat teaches one action, the narrator instructs ("toque", "digite"), and nothing that does not exist yet is shown.

### Format
- **"não precisa de vertical, para treinamento e apresentação nesse caso pode ser só horizontal"** (user, 14/10/2026, during the render of the Ramires tutorial "Como usar a Roberta", 2 min 5 s, both formats already built). Lesson: the "always 9:16 and 16:9" rule is for films that go to social media. A training video or a video to present in a meeting is delivered in 16:9 only; the vertical render was stopped at 23/25 chunks. Decide from the destination the request states; internal use gets 16:9 only.
- **"ahh eu queria uma versão 9:16 tbm"** (user, 16/10/2026, while the 16:9 renders of the Aprovador onboarding tutorial were running: a 3-minute training film and a 1-minute version a manager asked for, "de onboarding do app"). Lesson: a short onboarding film that is sent to new users, who watch it on their phones, also gets 9:16. The 3-minute training film stayed 16:9 only (agent's call, not yet confirmed by him).
- **"o video no total pode ter até 5 minutos, vamos focar no modo 9:16 pois a maioria dos aprovadores vai assistir no celular"** (user, same evening, relaying the manager). Lesson: the agent's call above was wrong for this audience. A tutorial of a phone app made for its end users is 9:16 first, whatever its length; the long and the 1-minute versions were merged into one 9:16 film of about 4 minutes. 16:9 only when the destination is a computer screen or a meeting.

### Voice and look (Ramires tutorial v2, 14/10/2026)
- **"ajustar a fala pois está com muitos erros e robotico, use outra voz do eleven labs mais natural"** (user, about the tutorial v1 narrated by the "Roberta" voice at speed 0.87 with pausas.mjs digital silence after every comma). What changed in v2 (agent's reading, not confirmed by him yet): 7 Brazilian library voices tested on the same paragraph and measured with entonacao.mjs; "Raquel" (GDzHdQOi6jjf8zaXhCYD, multilingual v2, stability 0.45, style 0.25, speed 1.0) had the widest pitch variation (3.8 to 4.1 st against 2.5 for Roberta) with falling sentence ends; v3 versions ended sentences rising. Script rewritten as spoken pt-BR ("pra", "é só"). No pausas.mjs: the digital zero it inserts inside sentences is the likely "robotic" cause. Lines that ended rising in every take were regenerated with their neighbours.
- **"não coloca a foto do balcão da Ramires, tira isso, deixa uma apresentação clean minimalista mas com motions e mods do claude code"** (user, mid-render of v2). The blurred store photo behind the app window read as noise. Replaced by a cream ground (#f3f0e8) with a slowly drifting dot grid, graphite text, white step pills and soft shadows; the brand red kept only for the "here" highlight. For tutorials of this user: clean light ground, no photo behind the UI.
- **"ficou com um sotaque estranho coloque uma voz masculina natural e valide a pontução, respiração e pausa nas falas e revise o vídeo completo"** (user, 15/10/2026, about v2 narrated by "Raquel"). The accent was not caught by any gate: Whisper heard every word, entonacao.mjs passed, and a model listener (Gemini 3.8 Flash judging the audio) later gave Raquel 10/10 for "native Brazilian accent", so model listening is not calibrated for accent. What changed in v3 (agent's reading): a native pt-BR male voice from Gemini 3.8 TTS's voice library (`pt-br-training-1`, an "instructional video host" persona) instead of a community voice run through ElevenLabs multilingual v2; recorded in blocks of one or two steps, 15 takes per block at most, picked line by line; missing comma pauses fixed with the TTS's own `<short pause>` tag, never with inserted digital silence; a line that ended "in the air" in all 12 takes was rewritten (a trailing appositive invites a continuation rise); each line cut keeping up to 0.35 s before it (the breath) and 0.10 s after. Whisper word times stretch a word across the pause next to it, so the PONTUAÇÃO line reported pauses that existed as missing: word boundaries are snapped to measured silence before measuring.
- Same review, picture: step pills stayed the whole step and, with the camera close, covered the UI text; the login page filled the frame with black on the clean cream film; the closing modal dissolved over the chat (a double exposure in a still); a lone waiting dot held for more than 3 s. v3: pill for 3.4 s on a soft cream band at the top of the frame, login card alone on the cream ground, modal leaves moving down and shrinking, the reply lands on the word that names it.

### Preferred (Ramires tutorial v3, 15/10/2026)
- **"ficou ótimo o vídeo"** (user, about v3: native pt-BR male voice from Gemini's library picked line by line with breaths kept, cream ground, step pill for 3.4 s on a cream band, login card on cream, moving showcase pieces). His only follow-up was to update the film to the panel version then in production; the voice, pace and look were kept as they were.


### Voice (Swipes commercial, 9:16 version, 17/10/2026)
- **"a voz da roberta esta meio robotizada, use uma voz nova do tts do google que lancou uma versao nova que concorre com eleven labs"** and **"Use uma voz feminina"** (user, asking for a 9:16 version of the Swipes commercial whose 16:9 was narrated by ElevenLabs "Roberta"; the ElevenLabs credits had also run out). Second time Roberta was called robotic (see the Ramires tutorial above). Three female Gemini 3.8 Flash TTS library voices were sent to his phone reading the same 14 s opening (`pt-br-commercial-2`, `pt-br-advisor-1`, `pt-br-podcaster-6`, with a Portuguese style prompt for a B2B tech commercial). **"Gostei do 3"**: `pt-br-podcaster-6` (radio host persona). Lesson: for this user, a commercial voice is chosen by ear from 2 or 3 short samples sent to the phone, not by measurement; the measured favourite would have been commercial-2 (podcaster-6 ran sentences together in the sample, fixed later by the kit's sentence pauses). The 16:9 kept Roberta until he asks.

### Aprovador tutorial, round 4 review on the phone (17/10/2026)
- **"No final cortou o entre em contato com a tecnologia da informa... cortou seco e acabou o vídeo."** (user, watching the 4 min 26 s round 4 on his phone, relayed by another session). Measured: the take kept speaking 0.28 s past Whisper's end of "Informação", and the voice assembler cut 0.12 s after it, so "-ção" was lost; then the film ended 0.36 s after the voice with the music cut at the last frame (the agent had trimmed the end for G3). Lessons: cut each sentence at measured silence in its take, never at Whisper's end; for this user the end gets about 1.8 s of brand after the last word with the music fading out, even though G3 then reports a long hold.
- **"Não precisa desses menus entre as etapas do vídeo, pode ir falando enquanto apresenta a tela do app."** (same review). Reacting to: full-screen part cards (title, subtitle, chips) with the phone off screen, made to answer the manager's "segregação clara de setup inicial e funcionalidades de uso". Lesson: keep the separation in the narration and in a small dark pill over the app ("Parte 1 de 3 · Configuração inicial"), with the app on screen showing each thing the voice names; no full-screen cards between steps.
- **"Usa a mesma voz do comercial swipes"** (same review). The tutorial voice changes from `pt-br-training-1` to `pt-br-podcaster-6`, the voice he chose by ear for the 9:16 commercial; the instructional style prompt stays, asking for falling sentence ends.

