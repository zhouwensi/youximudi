Component({
  properties: {
    label: { type: String, value: "" },
    active: { type: Boolean, value: false },
    name: { type: String, value: "" },
  },
  methods: {
    onTap() {
      this.triggerEvent("toggle", { name: this.data.name });
    },
  },
});
