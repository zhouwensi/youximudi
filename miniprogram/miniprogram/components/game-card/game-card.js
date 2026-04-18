const PLACEHOLDER = "/images/placeholder_cover.png";

Component({
  properties: {
    game: {
      type: Object,
      value: {},
    },
    showRemove: {
      type: Boolean,
      value: false,
    },
    showQuickMark: {
      type: Boolean,
      value: false,
    },
    /** 列表/首页：展示「我盼它回归」本地请愿（仅本机） */
    showPetitionMini: {
      type: Boolean,
      value: false,
    },
  },
  data: {
    coverSrc: PLACEHOLDER,
    shortIntro: "",
  },
  observers: {
    game(g) {
      if (!g || !g.game_name) {
        this.setData({ coverSrc: PLACEHOLDER, shortIntro: "" });
        return;
      }
      const cover = g.game_cover;
      let src = PLACEHOLDER;
      if (typeof cover === "string" && cover) {
        if (
          cover.indexOf("cloud://") === 0 ||
          cover.indexOf("http://") === 0 ||
          cover.indexOf("https://") === 0 ||
          cover.indexOf("/") === 0
        ) {
          src = cover;
        }
      }
      let intro = "";
      if (g.one_line) {
        intro = g.one_line;
      } else if (typeof g.game_intro === "string") {
        const t = g.game_intro.replace(/\s+/g, " ").trim();
        intro = t.length > 72 ? `${t.slice(0, 72)}…` : t;
      }
      this.setData({ coverSrc: src, shortIntro: intro });
    },
  },
  methods: {
    onCardTap() {
      const id = this.data.game && this.data.game._id;
      if (!id) return;
      this.triggerEvent("select", { gameId: id });
    },
    onRemoveTap() {
      const id = this.data.game && this.data.game._id;
      if (!id) return;
      this.triggerEvent("remove", { gameId: id, game: this.data.game });
    },
    onMarkTap() {
      const g = this.data.game;
      if (!g || !g._id) return;
      this.triggerEvent("mark", { game: g });
    },
    onPetitionTap() {
      const g = this.data.game;
      if (!g || !g._id) return;
      this.triggerEvent("petition", { game: g });
    },
  },
});
