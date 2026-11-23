// Site settings — edit freely. Leave a contact empty ("") to hide its button.
window.SETTINGS = {
  contacts: {
    telegram: "merelleynehq",          // t.me/<this> — personal account (DM), not the channel
    instagram: "merelleynehq",         // instagram.com/<this>
    email: "merelleynehq@gmail.com",
  },

  // Contact → Email opens a request form; letters arrive through Web3Forms (the key is public by design).
  // Empty key = the button opens the visitor's own mail app instead.
  formKey: "",

  // Licenses and fixed prices belong to a profile. A track uses the profile named in its "profile"
  // field (tracks.json); without one it uses defaultProfile.
  // price: null = no fixed price: a grey Contact button with the "askHint" text (i18n.js).
  defaultProfile: "merelleyne",
  currency: "₽",
  profiles: {
    merelleyne: {
      licenses: [
        { id: "wav",       name: "Lease WAV",        price: 2000 },
        { id: "stems",     name: "Lease STEMS",      price: 3500 },
        { id: "unlimited", name: "Lease UNLIMITED",  price: 5000 },
        { id: "exclusive", name: "Exclusive Rights", price: null },
      ],
    },
  },

  // Prepared Contact message, per site language. {list} is replaced with the selected tracks.
  messageWithTracks: {
    en: "Hi! I'm interested in these arrangements:\n{list}",
    ru: "Привет! Меня интересуют эти аранжировки:\n{list}",
  },
  // Used instead when software or sample packs are selected.
  messageWithProducts: {
    en: "Hi! I'm interested in:\n{list}",
    ru: "Привет! Меня интересует:\n{list}",
  },
  messageEmpty: {
    en: "Hi! I'm interested in your arrangements.",
    ru: "Привет! Меня интересуют ваши аранжировки.",
  },
  emailSubject: {
    en: "Arrangements inquiry",
    ru: "Запрос по аранжировкам",
  },

  // Other sections in the Arrangements menu. An empty section shows "Coming soon".
  // One line per item: { title: "Name", url: "https://…" } — url is optional:
  // with it a click on the row opens the page, without it a click selects the item.
  software: [],
  samples: [],
  // How many arrangements are in one volume (Vol. 01 = the first ten in the list, and so on).
  volumeSize: 10,

  // Links window (opens when you click the name MERELLEYNE). Order = order on the site.
  // Leave url empty ("") to hide a line. handle is the small grey text on the right.
  socials: [
    { name: "Instagram",  url: "https://www.instagram.com/merelleynehq", handle: "@merelleynehq" },
    { name: "Telegram",   url: "https://t.me/merelleyneqt",              handle: "@merelleyneqt" },
    { name: "YouTube",    url: "https://www.youtube.com/@merelleynehq",  handle: "@merelleynehq" },
    { name: "SoundCloud", url: "", handle: "" },
    { name: "Spotify",    url: "", handle: "" },
    { name: "TikTok",     url: "", handle: "" },
    { name: "Email",      url: "mailto:merelleynehq@gmail.com",          handle: "merelleynehq@gmail.com" },
  ],

  // Name used for free tagged downloads: "<artist> - <title> (tagged).mp3"
  artist: "Merelleyne",
};
