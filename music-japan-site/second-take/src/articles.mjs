// Article data. Every article carries a Japanese and an English edition.
// Block types inside a scene:
//   q     — the interviewer's question
//   a     — the interviewee's answer (speaker taken from `speaker`)
//   p     — editor's narration
//   quote — pull quote, rendered as a full-width "subtitle" frame

export const articles = [
  {
    slug: "rebuild-night",
    no: "01",
    date: "2026-09-12",
    minutes: 8,
    image: "sample-saeki",
    imageSize: [1600, 2400],
    focus: "50% 22%",
    ja: {
      name: "佐伯 遼",
      speaker: "佐伯",
      company: "株式会社NORTHBOUND",
      role: "代表取締役",
      tags: ["撤退", "再起", "組織"],
      title: "会社を畳むと決めた翌朝、彼は社員に何も言えなかった",
      dek: "売上は三分の一に落ち、資金が持つのはあと二か月。撤退を告げるつもりで出社した朝、会議室の机には、社員が一晩でまとめた再建案が並んでいた。",
      decision: "撤退を、一度だけ保留した。",
      subtitle: "数字より先に、会議から冗談が消えた。",
      brief: [
        "資金が尽きるまで二か月。代表は撤退を決めていた",
        "社員が一晩でつくった再建案を前に、発表を保留した",
        "会社の規模ではなく、顧客との関係を残すことを選んだ"
      ],
      intro: [
        "その夜、佐伯遼は一睡もしなかった。",
        "翌朝の全体会議で、会社を閉じると伝える。話す順番を紙に書き出し、取引先へ送るメールも下書きフォルダに入れてあった。",
        "ところが会議室のドアを開けた瞬間、用意した言葉が出てこなくなった。机の上には、顧客ごとの継続案と、残り二か月の資金計画が並んでいた。社員が夜のうちに作ったものだった。"
      ],
      scenes: [
        {
          heading: "「終わり」は、数字より先に来た",
          short: "数字より先に来たもの",
          blocks: [
            ["q", "最初に危ないと感じたのは、数字が落ちたときですか。"],
            ["a", "いえ、数字より前です。会議で誰も冗談を言わなくなった。悪い報告ほど上がってくるのが遅くなって、みんな僕の顔色を見ながら話すようになっていました。売上が落ちたのは、そのあとです。"],
            ["q", "その空気を変えようとはしましたか。"],
            ["a", "しました。「大丈夫だ」と言い続けた。でも、それが逆効果だったと思います。社員を安心させたかったのか、自分が現実を見たくなかったのか。途中から、自分でも分からなくなっていました。"],
            ["quote", "数字より先に、会議から冗談が消えた。"]
          ]
        },
        {
          heading: "撤退を告げる朝、机の上にあったもの",
          short: "机の上にあったもの",
          blocks: [
            ["q", "会社を閉じる判断は、一人で下したのですか。"],
            ["a", "最後は一人です。責任を誰かと分け合うふりはしたくなかった。夜中に資金繰り表を見直して、二か月後には給与を払えないかもしれないと分かった。その時点で、翌朝に伝えると決めました。"],
            ["p", "だが翌朝、社員たちは顧客ごとの継続条件、解約された場合の損失、会社を回すのに最低限必要な人数まで整理して待っていた。"],
            ["a", "「社長が諦めるなら仕方ありません。でも、僕たちはまだ終わったと思っていません」と言われました。うれしいというより、痛かった。僕だけが先に逃げようとしていたのかもしれない、と。"]
          ]
        },
        {
          heading: "会社ではなく、顧客を残す",
          short: "顧客を残す",
          blocks: [
            ["q", "その場で撤退を撤回したのですか。"],
            ["a", "撤回はしていません。僕が思い描いていた会社のかたちを、そこで一度終わらせることにしたんです。大きくなる前提を捨てて、いま確実に価値を出せる顧客だけを残す。役割も給与も、僕のところから全部見直しました。"],
            ["p", "会社を守ることと、会社のかたちを守ることは違う。佐伯は一度目の経営で握りしめていたものを、ひとつずつ手放していった。"],
            ["quote", "続けると決めても、元に戻すわけではなかった。"]
          ]
        },
        {
          heading: "二度目のテイクで、やめたこと",
          short: "二度目のテイク",
          blocks: [
            ["q", "いま同じ状況になったら、何を変えますか。"],
            ["a", "もっと早く「分からない」と言います。経営者が答えを持っているふりをすると、社員は質問できなくなる。あのとき必要だったのは完璧な計画ではなくて、悪い知らせが早く届く会社でした。"],
            ["q", "同じ失敗を繰り返さないために、決めていることはありますか。"],
            ["a", "ルールというほどのものではないですが、毎週ひとつ、怖い話をすることにしています。売上のことでも、人のことでもいい。その話が出てくるうちは、まだ間に合うと思っています。"]
          ]
        }
      ],
      profile: "法人向けサービスを運営する企業の代表。一度目の経営で撤退を決めかけ、社員の再建案をきっかけに会社を小さく作り直した。"
    },
    en: {
      name: "Ryo Saeki",
      speaker: "Saeki",
      company: "NORTHBOUND Inc.",
      role: "CEO",
      tags: ["Exit", "Comeback", "Team"],
      title: "The morning after he decided to close the company, he couldn’t say a word",
      dek: "Revenue had fallen by two-thirds, and the cash would last two more months. He came in to announce the shutdown — and found his team had spent the night writing a rescue plan.",
      decision: "He put the shutdown on hold. Once.",
      subtitle: "Before the numbers fell, the jokes disappeared from our meetings.",
      brief: [
        "Two months of cash left, and the CEO had decided to close.",
        "Faced with a rescue plan his team wrote overnight, he held back the announcement.",
        "He chose to keep the customers, not the size of the company."
      ],
      intro: [
        "Ryo Saeki didn’t sleep that night.",
        "At the all-hands the next morning, he would tell everyone the company was closing. He had written out the order in which he would say it. The emails to clients were already sitting in his drafts folder.",
        "But when he opened the meeting-room door, the words wouldn’t come. On the table lay a plan for keeping every client and a cash-flow plan for the remaining two months. His team had put it together overnight."
      ],
      scenes: [
        {
          heading: "The end arrived before the numbers did",
          short: "Before the numbers",
          blocks: [
            ["q", "Did you first sense trouble when the numbers dropped?"],
            ["a", "No, before that. People stopped joking in meetings. The worse the news, the later it reached me, and everyone started watching my face while they talked. Revenue fell after that."],
            ["q", "Did you try to change the mood?"],
            ["a", "I did. I kept saying, “We’re fine.” I think that backfired. Was I trying to reassure the team, or avoiding the truth myself? At some point I couldn’t tell anymore."],
            ["quote", "Before the numbers fell, the jokes disappeared from our meetings."]
          ]
        },
        {
          heading: "What was waiting on the table",
          short: "On the table",
          blocks: [
            ["q", "Did you make the decision to close on your own?"],
            ["a", "In the end, yes. I didn’t want to pretend the responsibility was shared. Late at night I went over the cash-flow sheet and realized we might not make payroll in two months. That’s when I decided to tell everyone the next morning."],
            ["p", "But the next morning, his staff were waiting with terms for keeping each client, the losses if clients left, and the minimum headcount the business could run on."],
            ["a", "Someone said, “If you’ve given up, we understand. But we don’t think this is over.” It didn’t feel good. It hurt. Maybe I was the one trying to run first."]
          ]
        },
        {
          heading: "Keep the customers, not the company",
          short: "Keep the customers",
          blocks: [
            ["q", "Did you call off the shutdown right there?"],
            ["a", "Not exactly. I decided to end the version of the company I’d been picturing. I dropped the assumption that we had to grow big and kept only the clients we could genuinely serve now. Roles, salaries — I reworked all of it, starting with my own."],
            ["p", "Protecting a company and protecting its shape are not the same thing. One by one, Saeki let go of what he had held on to the first time around."],
            ["quote", "Deciding to continue didn’t mean going back to how things were."]
          ]
        },
        {
          heading: "What he stopped doing on the second take",
          short: "The second take",
          blocks: [
            ["q", "If you faced the same situation today, what would you do differently?"],
            ["a", "I’d say “I don’t know” much sooner. When a CEO pretends to have every answer, people stop asking questions. What we needed back then wasn’t a perfect plan. It was a company where bad news travels fast."],
            ["q", "Is there a rule you keep so it doesn’t happen again?"],
            ["a", "Not a rule, exactly. Every week I bring up one thing that scares me — sales, people, anything. As long as those conversations keep happening, I think we still have time."]
          ]
        }
      ],
      profile: "CEO of a B2B services company. He came close to shutting it down, then rebuilt it smaller after his team put a rescue plan on the table."
    }
  },
  {
    slug: "failure-knew",
    no: "02",
    date: "2026-09-10",
    minutes: 6,
    image: "sample-kuroda",
    imageSize: [1400, 2100],
    focus: "50% 25%",
    ja: {
      name: "黒田 奈緒",
      speaker: "黒田",
      company: "合同会社SCALE",
      role: "共同代表",
      tags: ["新規事業", "撤退", "決断"],
      title: "失敗すると分かっていた。それでも、事業を止めるまでに一年かかった",
      dek: "赤字は毎月ふくらみ、顧客からは期待の声が届き続けた。撤退の条件は揃っていたのに、彼女は自分で決めた基準を三度書き換えた。",
      decision: "撤退の基準を、自分に守らせた。",
      subtitle: "打ち手があることと、勝てることを混同していた。",
      brief: [
        "売上は伸びていたが、三か月後に残る顧客が少なかった",
        "期待の声を理由に、撤退の基準を三度動かした",
        "基準を一人では変えられない仕組みにして、事業を閉じた"
      ],
      intro: [
        "黒田奈緒は、撤退の基準を自分で書いた。そして、その基準を自分で三度書き換えた。",
        "継続率は計画を下回り、広告費は膨らみ続けていた。会議のたびに「次の改善で変わります」と説明したが、数字は変わらなかった。",
        "止められなかったのは、分析が足りなかったからではない。数字の向こうに、期待してくれた人たちの顔が見えていたからだ。"
      ],
      scenes: [
        {
          heading: "違和感は、伸びている最中にあった",
          short: "伸びている最中に",
          blocks: [
            ["q", "事業が危ないと気づいたのは、どの数字でしたか。"],
            ["a", "継続率です。新しいお客様は増えているのに、三か月後に残っている人が少ない。売上のグラフは右肩上がりでも、実際はバケツの底に穴が開いている状態でした。"],
            ["q", "その時点で、撤退は考えましたか。"],
            ["a", "頭では考えました。でも、打ち手が残っているうちは失敗じゃない、と思っていたんです。いま振り返ると、打ち手があることと、勝てることを混同していました。"],
            ["quote", "打ち手があることと、勝てることを混同していた。"]
          ]
        },
        {
          heading: "止める基準は、なぜ三度動いたのか",
          short: "三度動いた基準",
          blocks: [
            ["q", "自分で決めた撤退基準を変えたのは、なぜですか。"],
            ["a", "そのたびに、希望に見える出来事があったからです。大きな問い合わせが来たり、熱のこもったメッセージをもらったり。数字は悪いままなのに、物語だけが続いていく感覚でした。"],
            ["p", "応援は挑戦を支える。同時に、判断を曇らせることもある。黒田は、顧客の期待に応えたい気持ちと、会社全体を守る責任とのあいだで立ち止まっていた。"],
            ["a", "続けることが誠実さだと思っていました。でも実際には、決める痛みを先送りしていただけでした。"]
          ]
        },
        {
          heading: "続ける理由を、探すのをやめた日",
          short: "探すのをやめた日",
          blocks: [
            ["q", "最終的に撤退を決めたきっかけは何でしたか。"],
            ["a", "共同代表に聞かれたんです。「もしこの事業をまだ始めていなかったとして、今日この数字を見て、始める？」と。答えは、いいえでした。"],
            ["p", "過去に使った時間とお金を守ろうとすると、これからの選択まで過去に引きずられる。黒田は翌日から、顧客への説明と返金、移行先の手配に取りかかった。"],
            ["quote", "始めた自分と、止める自分は、同じでなくていい。"]
          ]
        },
        {
          heading: "次の挑戦に残した、ひとつの約束",
          short: "ひとつの約束",
          blocks: [
            ["q", "次に新規事業を立ち上げるとき、何を変えますか。"],
            ["a", "撤退ラインを、自分との約束ではなくチームとの約束にします。一人では変えられないようにして、判断する日付も最初にカレンダーへ入れておく。情熱がある日にこそ、冷静な日の自分が決めたルールを残しておきたいんです。"]
          ]
        }
      ],
      profile: "新規事業開発を手がける企業の共同代表。伸びているように見えた事業を、一年かけて自らの判断で閉じた。"
    },
    en: {
      name: "Nao Kuroda",
      speaker: "Kuroda",
      company: "SCALE LLC",
      role: "Co-founder",
      tags: ["New ventures", "Exit", "Decisions"],
      title: "She knew it would fail. It still took her a year to stop",
      dek: "The losses grew every month, and so did the messages from customers who believed in the product. Every signal said stop. She rewrote her own exit criteria three times.",
      decision: "She made herself keep her own exit rule.",
      subtitle: "I confused having options with being able to win.",
      brief: [
        "Revenue was growing, but few customers stayed past three months.",
        "Encouraging messages led her to move the exit line three times.",
        "She made the rule impossible to change alone — and closed the business."
      ],
      intro: [
        "Nao Kuroda wrote her own criteria for shutting the business down. Then she rewrote them. Three times.",
        "Retention was below plan and ad spend kept climbing. At every meeting she said the next fix would turn things around. The numbers didn’t move.",
        "It wasn’t a lack of analysis that kept her going. Behind every number, she could see the faces of the people who were counting on her."
      ],
      scenes: [
        {
          heading: "The warning signs came while it was growing",
          short: "While it was growing",
          blocks: [
            ["q", "Which number told you the business was in trouble?"],
            ["a", "Retention. New customers kept coming, but few were still with us three months later. The revenue chart went up and to the right, but really it was a bucket with a hole in the bottom."],
            ["q", "Did you think about shutting down then?"],
            ["a", "Intellectually, yes. But I believed that as long as we had moves left, it wasn’t a failure. Looking back, I confused having options with being able to win."],
            ["quote", "I confused having options with being able to win."]
          ]
        },
        {
          heading: "Why the line moved three times",
          short: "The moving line",
          blocks: [
            ["q", "Why did you change the criteria you had set yourself?"],
            ["a", "Each time, something happened that looked like hope. A big inquiry, a heartfelt message from a customer. The numbers stayed bad, but the story kept going."],
            ["p", "Support can carry a new venture. It can also cloud judgment. Kuroda was stuck between wanting to live up to her customers’ hopes and her responsibility to the company as a whole."],
            ["a", "I thought continuing was the honest thing to do. Really, I was just putting off the pain of deciding."]
          ]
        },
        {
          heading: "The day she stopped looking for reasons to continue",
          short: "No more reasons",
          blocks: [
            ["q", "What finally made you decide?"],
            ["a", "My co-founder asked me, “If we hadn’t started this yet and you saw these numbers today — would you start it?” The answer was no."],
            ["p", "Trying to protect the time and money already spent drags every future decision back into the past. The next day, Kuroda began explaining the decision to customers, arranging refunds and finding them somewhere else to go."],
            ["quote", "The one who started it and the one who stops it don’t have to be the same person."]
          ]
        },
        {
          heading: "One promise for the next venture",
          short: "One promise",
          blocks: [
            ["q", "What will you do differently when you start the next one?"],
            ["a", "I’ll make the exit line a promise to the team, not to myself. Nobody can change it alone, and the decision date goes in the calendar on day one. On the days I’m most excited, I want the rules my calm self wrote to still be there."]
          ]
        }
      ],
      profile: "Co-founder of a company that builds new ventures. She spent a year deciding to close a business that looked, on paper, like it was growing."
    }
  },
  {
    slug: "leave-company",
    no: "03",
    date: "2026-09-08",
    minutes: 7,
    image: "sample-mori",
    imageSize: [1400, 2100],
    focus: "50% 20%",
    ja: {
      name: "森 圭介",
      speaker: "森",
      company: "株式会社RELAY",
      role: "創業者",
      tags: ["承継", "組織", "決断"],
      title: "守るために、辞めた。創業者が会社を離れるまでの143日",
      dek: "自分がいなければ、会社は前に進まない。そう信じてきた創業者が、自分こそが次の成長を止めていると認めるまで。",
      decision: "創業した会社を、自分から離れた。",
      subtitle: "会社に必要とされる自分を、守ろうとしていた。",
      brief: [
        "判断が創業者に集中し、組織の足が止まっていた",
        "後継者を選ぶより先に、自分の役割を手放した",
        "143日で権限を移し、会社の外へ出た"
      ],
      intro: [
        "森圭介の机には、毎朝、判断を仰ぐメモが積まれていた。",
        "創業から九年。会社をいちばん知っている自分が決めるのは、責任だと思っていた。だが、その責任が組織から考える機会を奪っていた。",
        "取締役会で代表交代を提案してから、最終出社日まで143日。これは会社を手放すまでの話ではない。会社から自分を引き剥がすまでの記録だ。"
      ],
      scenes: [
        {
          heading: "自分がいるから進まない、と認める",
          short: "自分がいるから",
          blocks: [
            ["q", "代表を退こうと考えた、直接のきっかけは何でしたか。"],
            ["a", "僕が一週間休んだとき、重要な判断が全部止まっていたんです。頼られていることを誇らしく思う自分もいました。でも同時に、これは組織じゃないと思った。"],
            ["q", "権限を渡すという選択肢もあったのでは。"],
            ["a", "何度も渡そうとしました。でも、最後に僕がひっくり返してしまう。手放せていなかったのは権限じゃなくて、「正解を知っている人」という立場でした。"],
            ["quote", "会社に必要とされる自分を、守ろうとしていた。"]
          ]
        },
        {
          heading: "後継者を選ぶ前に、やめたこと",
          short: "後継者を選ぶ前に",
          blocks: [
            ["q", "引き継ぎは、何から始めましたか。"],
            ["a", "会議で最後に話すことからです。僕が先に意見を言うと、それが答えになってしまうので。次に、僕しか知らない取引先との経緯を全部書き出しました。"],
            ["p", "森が残したのは業務の一覧だけではない。うまくいかなかった提案、約束を守れなかった日、関係を修復した言葉まで。会社の記憶そのものを書き残した。"],
            ["a", "きれいなマニュアルだけでは判断できないと思ったんです。どこで間違えたかが分かるほうが、次の人は強くなれる。"]
          ]
        },
        {
          heading: "最終出社日を、先に決める",
          short: "最終出社日",
          blocks: [
            ["q", "143日という期間は、どうやって決めたのですか。"],
            ["a", "完璧な引き継ぎを待っていたら、僕は永遠に辞められない。だから、次の経営計画を新しい体制だけで決められる日から逆算しました。"],
            ["p", "期限が決まると、相談が減り、報告が増えた。社員は森の許可ではなく、自分たちの判断を持ってくるようになった。"],
            ["quote", "残ることだけが、守ることではなかった。"]
          ]
        },
        {
          heading: "会社の外で始まった、二度目のテイク",
          short: "会社の外で",
          blocks: [
            ["q", "いま、会社との距離をどう感じていますか。"],
            ["a", "寂しいですよ。でも、僕の知らないところで決まったことで会社が前に進むたびに、ほっとします。創業者としていちばん見たかった景色は、自分がいないと見られないと思っていた。逆でした。"]
          ]
        }
      ],
      profile: "法人向けプロダクトを運営する企業の創業者。創業九年目に自ら代表交代を提案し、143日かけて会社を離れた。"
    },
    en: {
      name: "Keisuke Mori",
      speaker: "Mori",
      company: "RELAY Inc.",
      role: "Founder",
      tags: ["Succession", "Team", "Decisions"],
      title: "He left to protect it: 143 days to walk away from the company he founded",
      dek: "He believed nothing would move without him — until he admitted that he was the one holding the company back.",
      decision: "He walked away from the company he built.",
      subtitle: "I was protecting the version of me the company needed.",
      brief: [
        "Every decision ran through the founder, and the organization slowed down.",
        "Before choosing a successor, he gave up his own role.",
        "Over 143 days he handed over authority and stepped outside."
      ],
      intro: [
        "Every morning, Keisuke Mori’s desk was covered in notes asking him to decide something.",
        "Nine years after founding the company, he believed making the calls was his responsibility — no one knew the business better. But that sense of responsibility was taking away his team’s chance to think.",
        "From the board meeting where he proposed a new CEO to his last day in the office: 143 days. This isn’t a story about letting go of a company. It’s about prying himself loose from one."
      ],
      scenes: [
        {
          heading: "Admitting he was the bottleneck",
          short: "The bottleneck",
          blocks: [
            ["q", "What made you decide to step down?"],
            ["a", "I took a week off, and every important decision stopped. Part of me was proud to be relied on that much. But I also thought: this isn’t an organization."],
            ["q", "Couldn’t you have simply delegated?"],
            ["a", "I tried, many times. But in the end I’d overrule people. What I hadn’t let go of wasn’t authority. It was being the person who knew the right answer."],
            ["quote", "I was protecting the version of me the company needed."]
          ]
        },
        {
          heading: "What he stopped before choosing a successor",
          short: "Before a successor",
          blocks: [
            ["q", "Where did the handover start?"],
            ["a", "With speaking last in meetings. If I gave my opinion first, it became the answer. Then I wrote down everything only I knew about our history with each client."],
            ["p", "Mori left more than a list of tasks. Failed proposals, days he broke a promise, the words that repaired a relationship — he wrote down the company’s memory."],
            ["a", "A clean manual isn’t enough to make decisions with. If you know where things went wrong, the next person is stronger for it."]
          ]
        },
        {
          heading: "Setting the last day first",
          short: "The last day",
          blocks: [
            ["q", "How did you arrive at 143 days?"],
            ["a", "If I waited for a perfect handover, I’d never leave. So I counted back from the day the new team could set the next business plan on their own."],
            ["p", "Once the date was set, there were fewer requests for advice and more reports. People stopped bringing him questions for approval and started bringing their own decisions."],
            ["quote", "Staying wasn’t the only way to protect it."]
          ]
        },
        {
          heading: "The second take began outside the company",
          short: "Outside",
          blocks: [
            ["q", "How do you feel about the company now?"],
            ["a", "I miss it. But every time it moves forward on a decision I didn’t know about, I feel relieved. I thought the view I wanted most as a founder was one I could only see from the inside. It was the other way around."]
          ]
        }
      ],
      profile: "Founder of a B2B software company. In its ninth year he proposed his own replacement as CEO, then took 143 days to leave."
    }
  },
  {
    slug: "cofounder-split",
    no: "04",
    date: "2026-09-22",
    minutes: 7,
    image: null,
    ja: {
      name: "中村 拓真",
      speaker: "中村",
      company: "株式会社LANTERN",
      role: "代表取締役",
      tags: ["組織", "決断", "共同創業"],
      title: "大学の同級生と始めた会社で、その同級生に辞めてもらった",
      dek: "創業メンバーは二人。肩書きも株も半分ずつ。社員が30人を超えたころ、意見が割れても決められない会社になっていた。",
      decision: "共同創業者に、退任を切り出した。",
      subtitle: "仲がいいことと、一緒に経営できることは別だった。",
      brief: [
        "株も権限も半分ずつで、最後に決める人がいなかった",
        "半年かけて話し合い、共同創業者に退任を頼んだ",
        "いまも年に一度、二人で飲みに行く"
      ],
      intro: [
        "取材の途中、中村拓真は一度だけ黙った。共同創業者の名前を口にしたときだ。",
        "神田の雑居ビルの4階。窓際の会議室で、彼は湯呑みを両手で包んだまま、しばらく言葉を探していた。",
        "大学のゼミで知り合った二人が会社をつくったのは、27歳のとき。資本金も肩書きも、きっちり半分ずつにした。それが一番公平だと、当時は本気で思っていた。"
      ],
      scenes: [
        {
          heading: "半分ずつ、が公平だと思っていた",
          short: "半分ずつの会社",
          blocks: [
            ["q", "株も権限も半分ずつ、というのは珍しいですよね。"],
            ["a", "周りからは止められました。でも、どっちが上とか決めたくなかったんです。あいつがいなかったら会社をつくってないので。"],
            ["q", "うまく回っていた時期もあった。"],
            ["a", "最初の5年は本当に楽しかったです。僕が売って、あいつがつくる。ケンカしても、夜には一緒にラーメン食べてました。"],
            ["p", "変わったのは、社員が30人を超えたあたりからだという。採用の基準、値上げのタイミング、新しい事業に人を割くかどうか。二人の意見が割れると、会議はそこで止まった。"],
            ["quote", "仲がいいことと、一緒に経営できることは別だった。"]
          ]
        },
        {
          heading: "決められない会議が、毎週続いた",
          short: "決められない会議",
          blocks: [
            ["q", "意見が割れたら、どうしていたんですか。"],
            ["a", "持ち越しです。次の週に持ち越して、また割れて、また持ち越す。社員はどっちの顔色を見ればいいのか分からなくなっていました。"],
            ["a", "ある日、マネージャーの一人に言われたんです。『お二人の意見が揃うまで、僕たちは何もできません』って。責めるような言い方じゃなかったのが、逆にきつかった。"],
            ["p", "中村はその夜、共同創業者に「話がある」とだけメッセージを送った。返事は「俺も」だった。"]
          ]
        },
        {
          heading: "辞めてくれ、と言うまでの半年",
          short: "切り出すまで",
          blocks: [
            ["q", "すぐに退任の話をしたんですか。"],
            ["a", "いえ。最初は役割を分ければいいと思っていました。僕が経営、あいつが開発のトップ。でも、それをやっても最後の判断はやっぱり二人で並んでしまう。"],
            ["a", "半年くらい、週に一回、会社の外で話しました。最後は向こうから『どっちかが降りないと終わらないな』って言ったんです。僕は、それを待っていたのかもしれない。それがいまでも少し引っかかってます。"],
            ["p", "共同創業者は株の一部を残したまま取締役を退き、半年後、別の会社のCTOになった。"],
            ["quote", "言い出してもらうのを、待っていたのかもしれない。"]
          ]
        },
        {
          heading: "いまも、年に一度は飲みに行く",
          short: "その後の二人",
          blocks: [
            ["q", "いまの関係はどうですか。"],
            ["a", "年に一回、創業した日に二人で飲みます。仕事の話はほとんどしません。向こうの会社の愚痴を聞くくらいですね。"],
            ["q", "もう一度会社をつくるなら、同じ形にしますか。"],
            ["a", "しないです。仲のいい人とやるのはいい。でも、最後に誰が決めるかだけは最初に決めておく。それで関係が壊れるなら、そもそも一緒にやらないほうがいいと思っています。"]
          ]
        }
      ],
      profile: "法人向けSaaSを開発する企業の代表。大学の同級生と共同で創業し、9年目に経営体制を一本化した。"
    },
    en: {
      name: "Takuma Nakamura",
      speaker: "Nakamura",
      company: "LANTERN Inc.",
      role: "CEO",
      tags: ["Team", "Decisions", "Co-founders"],
      title: "He started the company with his best friend from college. Then he asked him to leave",
      dek: "Two founders, equal titles, equal shares. By the time they had 30 employees, nobody could make the final call.",
      decision: "He asked his co-founder to step down.",
      subtitle: "Getting along and running a company together turned out to be different things.",
      brief: [
        "With equal shares and equal authority, nobody had the final say.",
        "After six months of talks, he asked his co-founder to step down.",
        "They still go out for a drink together once a year."
      ],
      intro: [
        "Partway through the interview, Takuma Nakamura went quiet. It was the moment he said his co-founder’s name.",
        "We were on the fourth floor of an old office building in Kanda, Tokyo. He held his teacup in both hands and took a while to find the words.",
        "The two met in a university seminar and started the company at 27. They split the capital and the titles exactly down the middle. At the time, he genuinely believed that was the fairest way."
      ],
      scenes: [
        {
          heading: "Fifty-fifty seemed fair",
          short: "Fifty-fifty",
          blocks: [
            ["q", "Equal shares and equal authority is unusual."],
            ["a", "People told us not to. But I didn’t want to decide who was on top. Without him, I wouldn’t have started the company at all."],
            ["q", "And for a while it worked."],
            ["a", "The first five years were genuinely fun. I sold, he built. We’d argue, and by the evening we’d be eating ramen together."],
            ["p", "Things changed once they passed 30 employees. Hiring standards, when to raise prices, whether to put people on a new product. When the two disagreed, the meeting simply stopped."],
            ["quote", "Getting along and running a company together turned out to be different things."]
          ]
        },
        {
          heading: "Weekly meetings that decided nothing",
          short: "No decisions",
          blocks: [
            ["q", "What happened when you disagreed?"],
            ["a", "We postponed. Pushed it to the next week, disagreed again, pushed it again. The team didn’t know whose face to read anymore."],
            ["a", "One day a manager told me, “Until the two of you agree, we can’t do anything.” He didn’t say it as a complaint. That made it worse."],
            ["p", "That night Nakamura sent his co-founder a message that said only, “We need to talk.” The reply: “Me too.”"]
          ]
        },
        {
          heading: "Six months before he could say it",
          short: "Six months",
          blocks: [
            ["q", "Did you raise the idea of him leaving right away?"],
            ["a", "No. At first I thought we could split roles — me on the business, him leading engineering. But even then, the final call still sat with both of us."],
            ["a", "For about six months we met once a week outside the office. In the end, he was the one who said, “This won’t end unless one of us steps down.” Maybe I was waiting for him to say it. That still bothers me a little."],
            ["p", "His co-founder left the board while keeping part of his stake. Six months later he became CTO at another company."],
            ["quote", "Maybe I was waiting for him to say it first."]
          ]
        },
        {
          heading: "A drink, once a year",
          short: "Once a year",
          blocks: [
            ["q", "How are things between you now?"],
            ["a", "Once a year, on the day we founded the company, we go out for a drink. We barely talk about work. Mostly I listen to him complain about his company."],
            ["q", "If you started again, would you set it up the same way?"],
            ["a", "No. Starting a company with a friend is fine. But decide up front who makes the final call. If that breaks the friendship, you probably shouldn’t have started together."]
          ]
        }
      ],
      profile: "CEO of a B2B SaaS company he co-founded with a college classmate. In the company’s ninth year he consolidated leadership under one CEO."
    }
  },
  {
    slug: "factory-close",
    no: "05",
    date: "2026-09-28",
    minutes: 8,
    image: null,
    ja: {
      name: "早瀬 真理子",
      speaker: "早瀬",
      company: "早瀬製作所",
      role: "代表取締役（二代目）",
      tags: ["承継", "撤退", "事業転換"],
      title: "父が40年守った工場のラインを、二代目の私が止めた",
      dek: "継いで3年目、主力だった自動車部品の受注が半分になった。残ったのは、父の代から働く職人たちと、赤字のライン。",
      decision: "父の代の主力ラインを止めた。",
      subtitle: "止めると決めた日、父は工場に来なかった。",
      brief: [
        "主力の自動車部品の受注が、3年で半分になった",
        "父の代からの主力ラインを止め、試作品の加工に絞った",
        "職人は一人も辞めず、売上は2年で元の水準に戻った"
      ],
      intro: [
        "早瀬製作所の工場に入ると、まず油の匂いがする。早瀬真理子は「この匂いで育ったので」と笑った。",
        "埼玉県の工業団地にある、従業員18人の金属加工の会社。父が40年前に始め、彼女は銀行勤めを辞めて3年前に継いだ。",
        "継いだ年、主力だった自動車部品の受注は前年の半分になっていた。"
      ],
      scenes: [
        {
          heading: "継いだときには、もう減っていた",
          short: "継いだとき",
          blocks: [
            ["q", "継いだ時点で、状況は分かっていたんですか。"],
            ["a", "数字は見ていました。銀行にいたので、決算書を読むのは得意だったんです。でも、工場にいる人たちの顔を見ると、数字の話がなかなかできなくて。"],
            ["q", "お父様は何と。"],
            ["a", "『そのうち戻る』と。父の時代は、実際に何度も戻ってきたんです。だから父の言うことも分かる。でも、今回は戻らない理由がいくつもありました。"],
            ["quote", "数字の話が、なかなかできなかった。"]
          ]
        },
        {
          heading: "職人に、先に相談した",
          short: "職人に相談",
          blocks: [
            ["q", "ラインを止めると決めるまで、誰に相談しましたか。"],
            ["a", "父より先に、一番古い職人の佐藤さんに話しました。60代で、私が子どものころから工場にいる人です。怒られると思っていました。"],
            ["a", "そうしたら『社長が決めたなら、俺らは新しいほうを覚えるだけだよ』って。拍子抜けしたのと同時に、泣きそうになりました。"],
            ["p", "早瀬が考えていたのは、量産をやめて、大学や研究機関向けの試作品の加工に絞ることだった。一個から受ける。単価は高いが、図面のない相談も多い。職人の腕が一番生きる仕事でもあった。"]
          ]
        },
        {
          heading: "止めると決めた日、父は来なかった",
          short: "父との距離",
          blocks: [
            ["q", "お父様には、いつ伝えたんですか。"],
            ["a", "全部決めてからです。ずるいやり方だったと思います。父は何も言わずに聞いて、『お前の会社だ』とだけ言いました。"],
            ["a", "ラインを止めた日、父は工場に来ませんでした。毎日来ていた人が、その日だけ来なかった。それが答えだったんだと思います。"],
            ["quote", "止めると決めた日、父は工場に来なかった。"]
          ]
        },
        {
          heading: "2年後、売上は元に戻った",
          short: "2年後",
          blocks: [
            ["q", "いまはどうなっていますか。"],
            ["a", "職人は一人も辞めていません。売上は2年で継いだときの水準に戻りました。利益は、正直、父の代より出ています。"],
            ["q", "お父様は、いまは。"],
            ["a", "最近また工場に来るようになりました。試作品を手に取って、『こんなもんよく作るな』って。褒めてるのかどうか分からないんですけど、私はそれで十分です。"]
          ]
        }
      ],
      profile: "金属加工会社の二代目代表。銀行勤務を経て家業を継ぎ、量産から試作品加工へ事業の軸を移した。"
    },
    en: {
      name: "Mariko Hayase",
      speaker: "Hayase",
      company: "Hayase Manufacturing",
      role: "President (second generation)",
      tags: ["Succession", "Exit", "Pivot"],
      title: "Her father ran the line for 40 years. As his successor, she shut it down",
      dek: "Three years after she took over, orders for their main product — auto parts — had halved. What remained: craftsmen who’d worked for her father, and a production line losing money.",
      decision: "She shut down her father’s main production line.",
      subtitle: "The day she decided to stop the line, her father didn’t come to the factory.",
      brief: [
        "Orders for their core auto parts fell by half in three years.",
        "She shut the mass-production line and focused on prototype machining.",
        "No craftsman left, and revenue recovered within two years."
      ],
      intro: [
        "The first thing you notice in the Hayase Manufacturing workshop is the smell of machine oil. “I grew up with this smell,” Mariko Hayase said, laughing.",
        "It’s an 18-person metalworking company on an industrial estate in Saitama. Her father started it 40 years ago; she left a job at a bank to take over three years ago.",
        "In the year she took over, orders for their main product, auto parts, were half what they’d been the year before."
      ],
      scenes: [
        {
          heading: "When she took over, orders were already falling",
          short: "Taking over",
          blocks: [
            ["q", "Did you know the situation when you took over?"],
            ["a", "I’d seen the numbers. I came from a bank, so reading financial statements was the one thing I was good at. But when I looked at the people in the workshop, it was hard to talk about numbers."],
            ["q", "What did your father say?"],
            ["a", "“It’ll come back.” In his time, it really did come back, many times. So I understood him. But this time there were too many reasons it wouldn’t."],
            ["quote", "It was hard to talk about numbers."]
          ]
        },
        {
          heading: "She asked the craftsmen first",
          short: "The craftsmen",
          blocks: [
            ["q", "Who did you talk to before deciding to stop the line?"],
            ["a", "Before my father, I went to Mr. Sato, our longest-serving craftsman. He’s in his sixties and has been here since I was a child. I expected him to be angry."],
            ["a", "Instead he said, “If the boss has decided, we’ll just learn the new work.” I was taken aback, and close to tears."],
            ["p", "Her plan was to stop mass production and focus on prototype machining for universities and research labs — orders from a single piece, higher prices, and plenty of requests that arrive without drawings. It was also the work that used the craftsmen’s skills best."]
          ]
        },
        {
          heading: "The day she decided, her father stayed away",
          short: "Her father",
          blocks: [
            ["q", "When did you tell your father?"],
            ["a", "After everything was decided. It wasn’t fair of me. He listened without a word and then said, “It’s your company.”"],
            ["a", "On the day we stopped the line, he didn’t come to the factory. He’d come every single day, and that day he didn’t. I think that was his answer."],
            ["quote", "The day she decided to stop the line, her father didn’t come to the factory."]
          ]
        },
        {
          heading: "Two years on, revenue is back",
          short: "Two years on",
          blocks: [
            ["q", "Where do things stand now?"],
            ["a", "Not one craftsman has left. Revenue was back to where it was when I took over within two years. Honestly, profit is higher than in my father’s day."],
            ["q", "And your father?"],
            ["a", "He’s started coming by again. He picks up a prototype and says, “Can’t believe you make stuff like this.” I can’t tell if it’s praise, but it’s enough for me."]
          ]
        }
      ],
      profile: "Second-generation president of a metalworking company. After a career in banking she took over the family business and moved it from mass production to prototype machining."
    }
  }
];
