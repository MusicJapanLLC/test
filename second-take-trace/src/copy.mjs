// Interface copy for both editions. Keep keys identical between `ja` and `en`.

export const links = {
  booking: "https://timerex.net/s/music.japan.llc_5445/5c02ab1d",
  linkedin: "https://www.linkedin.com/in/%E5%8F%8B%E7%94%9F-%E5%A3%81%E8%B0%B7-4096373a7/",
  company: "https://music-japan.com/",
  companyEn: "https://music-japan.com/en"
};

// Navigation labels are English in both editions (masthead, bar, footer).
export const nav = [
  ["interviews", "Interviews", "/articles/"],
  ["briefs", "Short Reads", "/briefs/"],
  ["themes", "Themes", "/themes/"],
  ["podcast", "Podcast", "/podcast/"],
  ["about", "About", "/about/"]
];

export const copy = {
  ja: {
    htmlLang: "ja",
    ogLocale: "ja_JP",
    langName: "日本語",
    siteTitle: "SECOND TAKE｜経営者は、二度目に何を選んだか",
    siteDescription: "一度目がうまくいかなかった経営者が、二度目に何を選んだのか。撤退、再起、承継の決断を、本人の言葉で残すインタビューメディア。",
    tagline: "経営者は、二度目に何を選んだか。",
    skip: "本文へ移動",
    navLabel: "メインナビゲーション",
    search: "記事を検索",
    searchPlaceholder: "人物、会社、テーマから探す",
    searchEmpty: "該当する記事はありません。",
    menuOpen: "メニューを開く",
    menuClose: "閉じる",
    sample: "掲載中の人物・企業・記事は、デザイン確認用のサンプルです。",
    minRead: (m) => `${m}分`,
    readStory: "記事を読む",
    brief: "3分で要点",
    home: {
      cover: "Cover Story",
      latest: "Latest",
      latestSub: "最新のインタビュー",
      allStories: "すべての記事",
      editorLabel: "From the Editor",
      editorHeading: "失敗の続きに、その人がいる。",
      editorBody: "うまくいった話は、もう十分にある。SECOND TAKEが聞くのは、一度目がうまくいかなかった経営者が、二度目に何を選んだか。数字の裏にあった迷いを、本人の言葉で残していきます。",
      editorLink: "SECOND TAKEについて",
      themes: "Themes",
      themesSub: "テーマから読む",
      briefs: "Short Reads",
      briefsSub: "忙しい日に、決断だけを読む",
      briefsLink: "要点を読む",
      podcast: "SECOND TAKE Podcast",
      podcastHeading: "記事に入りきらなかった話を、本人の声で。",
      podcastBody: "取材の全編を、ポッドキャストとして配信する予定です。",
      podcastStatus: "配信準備中"
    },
    archive: {
      label: "Interviews",
      title: "すべてのインタビュー",
      lead: "経営者が迷い、選び、やり直した記録。\nテーマから絞り込めます。",
      all: "すべて",
      filterLabel: "テーマで絞り込む"
    },
    article: {
      interview: "Interview",
      credit: "取材・文",
      editor: "SECOND TAKE編集部",
      photo: "SAMPLE PHOTO / UNSPLASH",
      briefTitle: "In brief",
      briefSub: "3分で読む要点",
      scene: "Scene",
      toc: "In this story",
      textSize: "文字サイズ",
      sizes: ["標準", "大", "小"],
      profile: "Profile",
      sampleNote: "※ この人物・企業は、デザイン確認用に作成した架空のものです。",
      listenTitle: "Podcast",
      listenHeading: "記事に入りきらなかった話を、本人の声で",
      listenStatus: "配信準備中",
      share: "Share",
      copy: "リンクをコピー",
      copied: "コピーしました",
      next: "Next story",
      more: "More Interviews",
      resume: "前回の続きから読む",
      dismiss: "閉じる"
    },
    about: {
      title: "SECOND TAKEについて",
      label: "About",
      heading: "失敗の続きに、その人がいる。",
      lead: "SECOND TAKEは、経営者が一度目につまずいたあと、\n二度目に何を選んだのかを聞くインタビューメディアです。\n決めきれなかった時間と、決めた瞬間を記録します。",
      principlesTitle: "Principles",
      principlesSub: "編集方針",
      principles: [
        ["失敗を、美談にしない", "「乗り越えた話」にまとめる前の、迷っていた時間をそのまま聞きます。"],
        ["数字と感情を、同じ重さで", "売上や資金の事実と、そのとき何を感じていたかを、同じ重さで扱います。"],
        ["本人の言葉で、残す", "編集は最小限に。記事と声、二つのかたちで記録します。"]
      ],
      formatTitle: "Format",
      formatSub: "記事と声",
      formats: [
        ["Interview", "記事", "一人の経営者に、ひとつの決断を聞くロングインタビュー。四つのシーンで構成します。"],
        ["Short Reads", "3分の要点", "忙しい日のために、各記事の冒頭に決断の要点を三行でまとめています。"],
        ["Podcast", "声", "記事に入りきらなかった話を含む取材の全編を、本人の声で。配信を準備しています。"]
      ],
      publisherTitle: "Publisher",
      publisherSub: "運営",
      publisher: "SECOND TAKEは、合同会社Music Japanが運営する独立メディアです。",
      person: "代表　壁谷 友生"
    },
    contact: {
      title: "お問い合わせ",
      label: "Contact",
      heading: "お問い合わせ",
      lead: "SECOND TAKEへのご連絡は、オンラインでの打ち合わせで承ります。\n日程調整のページから、ご都合のよい時間をお選びください。",
      cases: [
        ["メディア・プレス", "記事の転載や引用、取材に関するお問い合わせ。"],
        ["協業・パートナーシップ", "共同での企画や、事業に関するご相談。"],
        ["海外から", "英語でのお問い合わせ、海外メディアとの連携について。"]
      ],
      book: "打ち合わせを予約する",
      bookNote: "TimeRexの日程調整ページが開きます"
    },
    pages: {
      briefsTitle: "3分で要点",
      briefsLead: "忙しい日に、決断だけを読む。\n各インタビューの要点を三行にまとめています。",
      themesTitle: "テーマから読む",
      themesLead: "撤退、承継、組織。\n経営者が向き合った決断を、テーマごとにまとめています。",
      themeCount: (n) => `${n}本のインタビュー`,
      podcastTitle: "記事に入りきらなかった話を、本人の声で。",
      podcastLead: "SECOND TAKEのインタビューは、すべて録音しています。\n記事では削った寄り道や沈黙も含めて、ポッドキャストとして配信する予定です。",
      podcastStatus: "配信準備中",
      podcastNote: "配信開始のお知らせは、このページでお伝えします。",
      moreTitle: "Previously",
      moreSub: "これまでのインタビュー",
      statsInterviews: "Interviews",
      statsThemes: "Themes",
      statsLanguages: "Languages",
      facesTitle: "In this issue",
      facesSub: "これまで話を聞いた人",
      faqTitle: "FAQ",
      faqSub: "よくある質問",
      faq: [
        ["取材を申し込むことはできますか？", "SECOND TAKEの取材は、編集部からお声がけしています。掲載のお申し込みは受け付けていません。"],
        ["記事を引用・転載できますか？", "引用は出典（SECOND TAKE・記事URL）を明記のうえご自由にどうぞ。転載をご希望の場合は、打ち合わせでご相談ください。"],
        ["英語での問い合わせはできますか？", "はい。英語でのお打ち合わせにも対応しています。"],
        ["打ち合わせはどのような形式ですか？", "オンラインで行います。日程調整ページ（TimeRex）からご予約ください。"]
      ]
    },
    notFound: {
      title: "ページが見つかりません",
      heading: "このテイクは、使われませんでした。",
      body: "お探しのページは移動したか、削除された可能性があります。",
      back: "トップへ戻る"
    }
  },

  en: {
    htmlLang: "en",
    ogLocale: "en_US",
    langName: "English",
    siteTitle: "SECOND TAKE — What leaders chose the second time",
    siteDescription: "Long-form interviews with founders and executives about what they chose after the first take went wrong: shutting down, starting over, stepping away.",
    tagline: "What leaders chose the second time.",
    skip: "Skip to content",
    navLabel: "Main navigation",
    search: "Search stories",
    searchPlaceholder: "Search by name, company or theme",
    searchEmpty: "No stories match.",
    menuOpen: "Open menu",
    menuClose: "Close",
    sample: "The people, companies and stories currently shown are samples for design review.",
    minRead: (m) => `${m} min`,
    readStory: "Read the story",
    brief: "In brief",
    home: {
      cover: "Cover Story",
      latest: "Latest",
      latestSub: "New interviews",
      allStories: "All interviews",
      editorLabel: "From the Editor",
      editorHeading: "There’s a person on the other side of every failure.",
      editorBody: "There are enough success stories. SECOND TAKE asks leaders what they chose the second time — after the first take went wrong — and records the doubt behind the numbers in their own words.",
      editorLink: "About SECOND TAKE",
      themes: "Themes",
      themesSub: "Read by theme",
      briefs: "Short Reads",
      briefsSub: "Just the decision, for busy days",
      briefsLink: "Read the brief",
      podcast: "SECOND TAKE Podcast",
      podcastHeading: "What didn’t fit in the article, in their own voice.",
      podcastBody: "The full interviews will be released as a podcast.",
      podcastStatus: "Coming soon"
    },
    archive: {
      label: "Interviews",
      title: "All interviews",
      lead: "Leaders who hesitated, chose and started again. Filter by theme.",
      all: "All",
      filterLabel: "Filter by theme"
    },
    article: {
      interview: "Interview",
      credit: "Interview & text",
      editor: "SECOND TAKE",
      photo: "SAMPLE PHOTO / UNSPLASH",
      briefTitle: "In brief",
      briefSub: "The decision in three lines",
      scene: "Scene",
      toc: "In this story",
      textSize: "Text size",
      sizes: ["Standard", "Large", "Small"],
      profile: "Profile",
      sampleNote: "This person and company are fictional, created for design review.",
      listenTitle: "Podcast",
      listenHeading: "What didn’t fit in the article, in their own voice",
      listenStatus: "Coming soon",
      share: "Share",
      copy: "Copy link",
      copied: "Copied",
      next: "Next story",
      more: "More Interviews",
      resume: "Continue where you left off",
      dismiss: "Dismiss"
    },
    about: {
      title: "About SECOND TAKE",
      label: "About",
      heading: "There’s a person on the other side of every failure.",
      lead: "SECOND TAKE is an interview publication about what leaders chose after the first attempt went wrong. We don’t retell the road to success. We record the time they couldn’t decide — and the moment they did.",
      principlesTitle: "Principles",
      principlesSub: "How we work",
      principles: [
        ["No redemption arcs", "We ask about the doubt before it became a story of overcoming."],
        ["Numbers and feelings, equally", "The facts of revenue and cash carry the same weight as what it felt like at the time."],
        ["In their own words", "Minimal editing. Every story is recorded twice: in print and in voice."]
      ],
      formatTitle: "Format",
      formatSub: "Print and voice",
      formats: [
        ["Interview", "The article", "One leader, one decision, told as a long-form interview in four scenes."],
        ["Short Reads", "Three lines", "For busy days, every story opens with the decision in three lines."],
        ["Podcast", "The voice", "The full interview, including what didn’t fit in the article, in the guest’s own voice. Coming soon."]
      ],
      publisherTitle: "Publisher",
      publisherSub: "Published by",
      publisher: "SECOND TAKE is an independent publication by Music Japan LLC, based in Japan.",
      person: "Tomoki Kabeya"
    },
    contact: {
      title: "Contact",
      label: "Contact",
      heading: "Contact",
      lead: "We take enquiries through a short online meeting.\nChoose a time that suits you on our scheduling page.",
      cases: [
        ["Media and press", "Republishing, quoting our stories, or press enquiries."],
        ["Partnerships", "Co-produced projects and business enquiries."],
        ["International", "Enquiries in English and work with media outside Japan."]
      ],
      book: "Book a meeting",
      bookNote: "Opens our TimeRex scheduling page"
    },
    pages: {
      briefsTitle: "Short Reads",
      briefsLead: "Just the decision, for busy days.\nEvery interview, in three lines.",
      themesTitle: "Read by theme",
      themesLead: "Exits, successions, teams.\nThe decisions our guests faced, grouped by theme.",
      themeCount: (n) => `${n} ${n === 1 ? "interview" : "interviews"}`,
      podcastTitle: "What didn’t fit in the article, in their own voice.",
      podcastLead: "Every SECOND TAKE interview is recorded.\nWe plan to release them as a podcast, detours and silences included.",
      podcastStatus: "Coming soon",
      podcastNote: "We’ll announce the launch on this page.",
      moreTitle: "Previously",
      moreSub: "Earlier interviews",
      statsInterviews: "Interviews",
      statsThemes: "Themes",
      statsLanguages: "Languages",
      facesTitle: "In this issue",
      facesSub: "The people we’ve spoken to",
      faqTitle: "FAQ",
      faqSub: "Common questions",
      faq: [
        ["Can I apply to be interviewed?", "Interviews for SECOND TAKE are by invitation from our editors. We don’t accept applications for coverage."],
        ["Can I quote or republish your stories?", "You’re welcome to quote us with a credit (SECOND TAKE and the article URL). To republish, please talk to us first."],
        ["Can I contact you in English?", "Yes. Meetings can be held in English."],
        ["What format are meetings?", "Online. Please book a time through our TimeRex scheduling page."]
      ]
    },
    notFound: {
      title: "Page not found",
      heading: "This take didn’t make the cut.",
      body: "The page you’re looking for may have moved or been removed.",
      back: "Back to the front page"
    }
  }
};
