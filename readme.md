# 🐗 EAntiCheat

EAntiCheat is a lightweight and effective open-source anticheat solution designed specifically for FiveM servers.

## ✨ Features

- ⚡ Lightweight and fast execution
- 🛡️ Detects common exploit patterns
- 🔐 Obfuscated server/client code
- 🧩 Easy to integrate
- 📝 Web Interface Ready (for paid/extended versions)

## 📦 Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/EAntiCheat.git
```

2. Add it to your server resources:

```bash
ensure EAntiCheat
```

3. Configure `fxmanifest.lua` if needed.

## ⚙️ Configuration

Edit the provided configuration file to match your server's structure. The basic version does not require a database.

## 📁 Folder Structure

```
EAntiCheat/
├── project/
│   └── Includes all related files to the Project, Server Side and Client Side
├── data/
│   └── Includes all data like files, for example forbidden Models
├── web-interface/
│   └── Not for the Public at this point.
└── README.md
```

## 🧪 Development

To build your own version:

```bash
cd ./project && bun install
bun run build
```

This will compile and optionally obfuscate your code for production.

## 📌 Notes

- The free version is open source and can be modified to suit your needs.
- The commercial version includes:
  - Web panel
  - Live monitoring tools
  - Discord integrations
  - Advanced rule engine
  - Cloud-based detection

## Contact

- Discord: revolutionpumba
- Discord-Server: https://discord.gg/wfXfKzHFJw

## ❤️ Contributing

Pull requests are welcome. For major changes, open an issue first to discuss what you would like to change.

## 📄 License

[MIT](LICENSE)

---

Made with 🐗 by Pumba
