# Combined English curriculum audit

Reviewed: 2026-10-17

## Release result

The final practical JSON files were imported alongside the corrected business pack
The combined 200 units have no duplicate normalized learning-target headings
Practical unit IDs remain p-001–p-100, with 50 chunks, 30 vocabulary lessons and 20 grammar lessons
All 100 practical examples contain 19–25 space-delimited words, have 3–5 consecutive exact chunks, and include full Japanese translations and editorial broad US IPA
The practical structural validator returns `pass`, with no errors

Files reviewed were the authoring JSON in `curriculum-business/` and `curriculum-practical/`, not a deployed build
The combined import was validated by the English publication test. This source review does not itself establish production publication

## Scope and editorial method

All 200 learning-target headings were considered alongside their Japanese meanings, category, register and editorial B1+/B2/C1 level
The review also examined the business examples, explanations and Japanese translations, checked long IPA strings for context-sensitive words, and reviewed the practical travel dialogues and their fictional circumstances
IPA review was editorial and targeted at plausible semantic or pronunciation errors; it was not a phonetics specialist's certification of every segment

Exact duplicate detection normalized case, punctuation and ellipses
An additional semantic review identified repetitions that differed in wording but taught substantially the same productive pattern, such as the present perfect continuous, indirect questions, `used to`, past deduction and checking understanding
These targets were replaced in the practical pack rather than retained under slightly different headings
An example may naturally contain grammar taught elsewhere; shared supporting language is not itself a duplicate target

## Practical replacements completed

31 practical units were replaced in full, retaining their IDs and kinds
Each replacement includes an original example, exact chunk segmentation, Japanese usage guidance and caution, and hand-edited broad US IPA

| ID | Previous overlap or target | New distinct target |
|---|---|---|
| p-011 | Could you walk me through ... | Is there somewhere I can ...? |
| p-016 | Did not catch / listening repair | Could you slow down a little? |
| p-017 | Say/put it another way | What's the word for ...? |
| p-018 | Checking understanding | Could you spell ... for me? |
| p-019 | What I meant | I can't think of the exact word, but ... |
| p-025 | Let me rephrase that | How do you pronounce ...? |
| p-035 | Come/start to realize | It took me a while to ... |
| p-036 | Part of me | I'm trying to make sense of ... |
| p-040 | Changed the way | What do you find most rewarding about ...? |
| p-061 | perspective | spontaneous |
| p-062 | assumption | misinterpret |
| p-063 | nuance | forthcoming |
| p-064 | ambivalent | reluctant |
| p-065 | vulnerable | self-conscious |
| p-066 | resilient | resourceful |
| p-069 | articulate | elaborate, verb |
| p-071 | rapport | common ground |
| p-073 | mutual | receptive |
| p-082 | Indirect questions | Am I supposed to ...? |
| p-083 | I was wondering | I was going to ... |
| p-085 | Present perfect continuous | I ended up ... |
| p-086 | used to | I'm about to ... |
| p-087 | get used to | I need to have ... repaired. |
| p-090 | What cleft | not ... until ... |
| p-092 | I wish I could | too ... to ... / ... enough to ... |
| p-093 | Second conditional | It's not as ... as ... |
| p-094 | Third conditional | in case ... |
| p-095 | might have | not that ... |
| p-096 | Past deduction | keep (on) + -ing |
| p-098 | Emphatic do | I'd better ... |
| p-099 | as long as | unless ... |

The new vocabulary targets were checked against the substantively reviewed dictionary entries P56–P64
`elaborate` is explicitly taught as the verb, with the ending /eɪt/, and distinguished from the adjective
`forthcoming` distinguishes openness about information from an upcoming event
`receptive` describes willingness to consider a suggestion, with no inference that it establishes romantic interest or consent
`self-conscious` is distinguished from self-awareness and self-confidence
The new grammar explanations distinguish `in case` preparation from an `if` condition, past intention from actual completion, and having something repaired from repairing it oneself

The related lesson IDs were revised in pd-03, pd-05, pd-07, pd-08, pd-09, pd-10 and pd-12
The 12 complete practical dialogue scripts still contain 120 turns in total

## Business issues reported and verified in the current authoring JSON

| Location | Issue | Current status |
|---|---|---|
| bd-03, turn 3 | `people update it` had the noun's initial stress in IPA | Corrected to verb /ʌpˈdeɪt/ and rechecked |
| b-031 | Japanese `会場と機材を対応` was ungrammatical | Corrected to `会場や機材の手配を担当` and rechecked |
| b-086 | `cant` and `couldnt` in explanation lacked apostrophes | Corrected to `can't` and `couldn't` and rechecked |
| b-097 | `didnt` and `isnt` in explanation lacked apostrophes | Corrected to `didn't` and `isn't` and rechecked |
| b-098 | An isolated ellipsis example did not establish the action omitted after `to` | Replaced with a self-contained 20-word example, full Japanese, IPA and four chunks; rechecked |

The corrected b-098 example is:

> You asked why I didn't call. I wanted to, but I wasn't sure whether you needed some time to yourself.

The first sentence supplies `call`, making the omitted verb phrase recoverable from the same card

Two additional editorial suggestions were sent to the parent and then applied during final integration, including the matching English/chunk/IPA changes:

| Location | Suggestion | Reason |
|---|---|---|
| b-034 explanation | Change `必要なら謝意を続ける` to `必要なら謝罪の言葉も続ける` | `謝意` can be read as gratitude, whereas the lesson concerns acknowledging responsibility and apologizing |
| b-028 example | If the intended meaning is specifically early in the month, use `We're aiming for a launch early next month` and update matching chunks/IPA | `an early launch next month` can describe an early launch relative to the plan, without fixing its position within the month |

## Pronunciation findings and limits

The business helper's default handling of heteronyms was not treated as proof of a current data error
The current inspected uses of `use`, `used to`, `live conversation`, `separate agreement`, `lead` and `project` were read in their sentence context
No current `read` or `record` token requiring an unhandled alternate pronunciation was identified

The two packs use somewhat different conventions, including /e/ versus /ɛ/, /r/ versus /ɹ/, and different long-vowel marking
These are broad-transcription notation differences; an IPA guide should make the editorial convention clear
They should not be marketed as a recording-level transcription or as exact alignment to the browser voice

Two initially suspicious forms are legitimate dictionary variants, so they were not flagged as errors:

- The business pronunciation of `comfortable` without an overt /r/ is among the variants listed in [Merriam-Webster: comfortable](https://www.merriam-webster.com/dictionary/comfortable), headword pronunciation, lines 34–44
- Different `caveat` pronunciations in the heading and example are supported variants in [Merriam-Webster: caveat](https://www.merriam-webster.com/dictionary/caveat), pronunciation, lines 34–40; using one variant consistently within the card would still make learning easier

These two audit-only source checks were not added to the practical curriculum's 81-source total

## Travel and conversational facts

The passport-control scenario describes an invented visitor's stated tourism plans and return booking
The goods-declaration scenario separately covers food and a wooden souvenir, with inspection left to the officer
The connecting-baggage dialogue expressly makes the staff answer a fact about the fictional reservation rather than a general claim that bags always transfer automatically
The hotel dialogue describes an authorization hold as part of that hotel's fictional arrangement, without claiming a universal policy

Relevant primary travel sources are [Australian Border Force: Incoming Passenger Card](https://www.abf.gov.au/entering-and-leaving-australia/crossing-the-border/at-the-border/incoming-passenger-card-(ipc)), [Home Affairs: Crossing the border](https://immi.homeaffairs.gov.au/entering-and-leaving-australia/entering-australia/crossing-the-border), [Australian agriculture department: Biosecurity questions and answers](https://www.agriculture.gov.au/biosecurity-trade/policy/faqs) and [UK Government: Border control](https://www.gov.uk/uk-border-control)
The examples ask learners to answer according to their real situation and do not imply admission, baggage routing or permission to import an item is guaranteed

The dating dialogues establish adult interaction, make a date invitation explicit where appropriate, progress to practical scheduling, and include accepting different relationship preferences
The scripts do not rely on insults, pressure, invented social prevalence or claims that a phrase produces attraction

## Evidence ledger and final validation

The practical source ledger now contains 81 substantively reviewed unique URLs, including 26 additions P56–P81, and 14 retrieval or source-selection gaps
The 81 reviewed sources comprise 54 Merriam-Webster dictionary pages, 13 British Council grammar pages, 3 British Council speaking pages, 1 BBC Learning English worksheet, 1 Englishpage.com grammar tutorial, 4 government pages and 5 Reddit discussions
74 reviewed source IDs are directly cited by final units; 7 were reviewed as background or while considering earlier targets
The count is a count of pages, not independent publishers or independent studies

The X and Threads original-post coverage gap remains explicit
Reddit material establishes contextual examples and contrasting opinions, not population-level usage frequency or verified native-speaker prevalence
The review does not support claims of 800 sources, comprehensive social-platform coverage, certified CEFR levels, specialist IPA approval, or guaranteed learning outcomes

Final practical counts: 100 units, 100 original examples, 12 dialogues, 120 turns; travel 33, repair 15, social 33, flirting 19; editorial levels B1+ 12, B2 81, C1 7

No katakana pronunciation guides were introduced
Ordinary Japanese loanwords in Japanese explanation fields are not pronunciation guides

## Combined import record

The integrated app contains 200 distinct learning targets: 100 chunks, 60 vocabulary entries and 40 grammar entries, plus 24 dialogues with 240 turns. After deduplicating URLs between packs, the public source ledger contains 106 reviewed URLs and 25 retrieval/selection gaps. Original retrieval metadata and source body text are not embedded in the published payload.
