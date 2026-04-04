Component({
  properties: {
    message: { type: String, value: "" },
    showButton: { type: Boolean, value: false },
    buttonText: { type: String, value: "去看看" },
  },
  methods: {
    onGo() {
      this.triggerEvent("go");
    },
  },
});
