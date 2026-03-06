# Contributing to Starship Alexandria

Thanks for your interest in contributing! This project is a cozy roguelike about recovering lost literature, and contributions of all kinds are welcome -- code, content, accessibility improvements, bug reports, and ideas.

## Getting Set Up

1. Fork the repository and clone your fork:

```bash
git clone https://github.com/<your-username>/starship-alexandria.git
cd starship-alexandria
```

2. Install dependencies (requires Node.js 20+):

```bash
npm install
```

3. Start the dev server:

```bash
npm run dev
```

4. Open [http://localhost:8080](http://localhost:8080) in your browser. The server hot-reloads on file changes.

## Submitting Changes

1. Create a branch from `main` for your work:

```bash
git checkout -b my-feature
```

2. Make your changes and verify the build passes:

```bash
npm run build
```

3. Push your branch and open a pull request against `main`.

Please keep PRs focused -- one feature or fix per PR is ideal. Include a brief description of what your change does and why.

## Code Style

- **TypeScript strict mode** is enabled. Avoid `any` unless unavoidable (add a `TODO` comment if you must).
- **Functional React components** with hooks. No class components.
- **Composition over inheritance** for Phaser game entities.
- All state changes go through the **Zustand store** actions -- never mutate state directly.
- Phaser and React communicate through the **EventBridge**, not direct imports.
- Linting is configured in `.eslintrc.json`. Run your editor's linter or check for errors before submitting.

## Accessibility

Accessibility is a core requirement, not an afterthought. When contributing UI or gameplay changes:

- All React UI must use **semantic HTML**, ARIA landmarks, and proper heading hierarchy.
- Game events that convey important information must emit to the **ARIA live region** (`AccessibleLog` component), not just render on canvas.
- All interactions must work with **keyboard only** (arrow keys/WASD for movement, Space/Enter/E for interaction, Escape to close overlays).
- Interactive elements (player, books, NPCs) must be **visually distinct** with high contrast -- thick outlines, highlight rings, bright colors on dark backgrounds.
- UI text must meet **WCAG 2.2 Level AA** contrast ratios (4.5:1 for normal text, 3:1 for large text).

## Content Contributions

Game content is defined in YAML files under `content/` and validated at build time. See [EDITING.md](EDITING.md) for details on the format and how to add:

- **Books and fragments** (`books.yaml` + text files in `content/texts/`)
- **NPC dialogue** (`npcs.yaml`, `dialogue.yaml`)
- **Journal entries** (`journals.yaml`)
- **Artifacts** (`artifacts.yaml`)
- **Room names** (`rooms.yaml`)

All literature must be **public domain**. [Project Gutenberg](https://www.gutenberg.org/) is the primary source.

## Reporting Bugs

Open a [GitHub issue](https://github.com/sethwilsonUS/starship-alexandria/issues) with:

- What you expected to happen
- What actually happened
- Steps to reproduce
- Browser and OS (if relevant)

## Questions?

Open a discussion or issue. There are no bad questions.
