<div align="center">

# GML Assistant

### AI Workspace Companion for GameMaker Studio 2

<p>
Context-aware AI tooling focused on large GML projects, debugging, refactoring, and accelerated implementation workflows.
</p>

<br/>

<img src="https://img.shields.io/badge/Open%20Source-Yes-3fb950?style=for-the-badge" />
<img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" />
<img src="https://img.shields.io/badge/Platform-Windows-0078D6?style=for-the-badge" />

<br/>

<img src="https://img.shields.io/badge/Frontend-React-20232A?style=flat-square&logo=react&logoColor=61DAFB" />
<img src="https://img.shields.io/badge/Desktop-Electron-191970?style=flat-square&logo=electron&logoColor=white" />
<img src="https://img.shields.io/badge/Runtime-Node.js-43853D?style=flat-square&logo=node.js&logoColor=white" />
<img src="https://img.shields.io/badge/AI-llama.cpp-black?style=flat-square" />
<img src="https://img.shields.io/badge/Inference-GGUF-red?style=flat-square" />
<img src="https://img.shields.io/badge/CUDA-Supported-76B900?style=flat-square&logo=nvidia&logoColor=white" />

</div>

---

# Overview

GML Assistant is an open-source desktop application created specifically for GameMaker Studio 2 developers who work with medium to large `.yyp` projects and need a more practical way to integrate AI into real development workflows. Instead of behaving like a generic chatbot disconnected from the project structure, the application attempts to understand the workspace itself, retrieve relevant files, analyze relationships between scripts and objects, and provide context-aware assistance focused on actual engineering tasks.

The project was created around a simple idea: modern AI models are extremely useful for software development, but most existing tools are optimized either for web development ecosystems or for short isolated prompts. GameMaker projects often become difficult to manage as they grow because mechanics are heavily interconnected through events, inheritance, object interactions, and custom systems. Copy-pasting fragments of code into a browser chat quickly becomes inefficient once a project reaches a certain scale.

GML Assistant attempts to solve that problem by acting as a dedicated workspace companion rather than a generic AI frontend. The goal is not to replace development knowledge, but to reduce the friction involved in maintaining large GML codebases, implementing repetitive systems, debugging complex interactions, and accelerating technical workflows that normally consume significant development time.

---

# Philosophy

This application was not designed around the concept of “vibe coding” or autonomous game generation. It is important to understand this before using the tool because the quality of the results depends heavily on how it is approached. The assistant works best when the developer already understands the structure of the game they are building and uses the AI as an accelerator instead of a replacement for technical reasoning.

The intended workflow is collaborative. The developer defines architecture, mechanics, gameplay rules, system boundaries, and technical goals while the AI assists with implementation, iteration, refactoring, debugging, boilerplate generation, and analysis. In practice, this means the application is most useful for people who already actively work with GML and want to reduce the amount of time spent on repetitive or mentally exhausting tasks.

The assistant is particularly effective when dealing with long debugging sessions, obscure edge cases, large scripts, shader experimentation, AI systems, movement logic, collision problems, save systems, inventory structures, dialogue frameworks, procedural systems, and general refactoring. It is not intended to magically produce complete games from vague prompts, and attempting to use it that way usually leads to poor project structure and difficult maintenance later on.

The philosophy behind the project is simple: AI should enhance engineering workflows, not replace engineering discipline.

---

# Core Functionality

The application integrates directly with GameMaker Studio 2 projects and attempts to operate with awareness of the workspace instead of isolated prompts. Once a `.yyp` project is opened, the assistant scans the project structure, identifies relevant scripts and objects, and retrieves contextual information dynamically depending on the request being made.

This allows the AI to reason using far more relevant information than traditional copy-paste workflows. Instead of manually feeding dozens of files into a chat window, the retrieval system attempts to assemble the most relevant project context automatically while respecting token limitations. The result is significantly more useful responses when dealing with interconnected gameplay systems or large codebases.

One of the most important aspects of the workflow is the diff review system. Rather than blindly injecting generated code into files, the application presents modifications through a dedicated comparison viewer that exposes the previous version, the generated version, and the reasoning behind the changes. This makes it possible to inspect and validate modifications before applying them to the project. Backup `.bak` files are also created automatically to reduce the risk of destructive edits.

The application additionally includes a sanitizer for invisible unicode artifacts generated by LLMs. Certain models occasionally produce hidden characters such as zero-width spaces or malformed formatting symbols that silently break GML compilation. The sanitizer scans the project and removes these artifacts automatically, preventing frustrating debugging situations that are otherwise difficult to identify manually.

---

# Local AI Support

A major focus of the project is local inference support. The application integrates with `llama.cpp` and `node-llama-cpp` in order to run GGUF models directly on the user's hardware. This allows the entire workflow to function offline without relying on external services or subscriptions.

Running models locally provides several advantages. Privacy-sensitive projects never need to leave the machine, development remains possible without internet access, and experimentation becomes unrestricted because there are no API costs associated with long sessions or repeated iterations. This is particularly useful for developers who spend large amounts of time debugging or testing architectural variations.

The application supports multiple model families including Qwen, Llama, DeepSeek, Mistral, Phi, and Gemma variants depending on hardware limitations and project requirements. The included model management workflow allows users to download, organize, and load GGUF models directly inside the application.

---

# Turbo Quantization and VRAM Optimization

One of the more technically important features of the project is its support for KV cache quantization and VRAM optimization strategies. Large codebases require large context windows, but large contexts quickly become expensive in terms of memory usage. Consumer GPUs frequently become a bottleneck when attempting to run coding models locally with extended contexts.

To address this, the application supports multiple KV cache quantization modes including `f16`, `q8_0`, and `q4_0`. These configurations allow users to balance inference quality, speed, and VRAM consumption depending on their hardware. In practice, this makes it possible to run much larger contexts on GPUs that otherwise would not be capable of handling them.

The application also exposes dynamic GPU offloading controls, allowing users to determine how many layers are processed on GPU versus CPU. This is especially useful when attempting to maximize performance without exceeding VRAM limitations or destabilizing the system during inference.

These optimizations are extremely important for GameMaker projects because large GML workspaces can easily exceed the context capacity that many local AI setups can comfortably process without aggressive memory optimization.

---

# Cloud API Support

Although local inference is a major focus, the application also supports cloud-based providers through OpenAI-compatible APIs. This includes providers such as OpenAI, Gemini, Groq, DeepSeek, and OpenRouter depending on the configuration used by the user.

Cloud inference is useful for users who either lack powerful local hardware or simply want access to larger and more capable hosted reasoning models. The workflow remains mostly identical regardless of whether the assistant is using local inference or cloud inference, which allows developers to switch between environments depending on the task being performed.

For example, some users may prefer local models for iterative debugging sessions while using cloud models for larger reasoning tasks or architecture discussions.

---

# Installation and Environment Setup

Because the application relies on Electron, Node.js, native bindings, and optional GPU acceleration, the environment setup process is more technical than a standard frontend application. Users should expect to install development dependencies and potentially compile native modules during installation.

The recommended environment is Windows with Node.js v18 or newer installed alongside Git and Visual Studio Community configured with the “Desktop development with C++” workload enabled. This is necessary because `node-llama-cpp` compiles native binaries during installation.

For NVIDIA users, CUDA installation is highly recommended in order to achieve acceptable local inference performance. Installing the CUDA Toolkit and ensuring that GPU drivers are properly updated allows the application to compile GPU-accelerated inference backends automatically during dependency installation. Users can verify correct CUDA installation by checking whether `nvcc --version` returns valid version information inside a terminal.

Once the environment is configured, the installation process is relatively straightforward.

```bash
git clone https://github.com/yourusername/gml-assistant.git
```
```bash
cd gml-assistant
```
```bash
npm install
```
```bash
npm run dev
```

The first installation may take several minutes because native inference components and acceleration backends are compiled specifically for the local machine configuration.

---

# Recommended Workflow

The application should ideally be used alongside proper version control practices. While the assistant creates backup files before applying modifications, AI-generated code should never be treated as automatically trustworthy. Developers are strongly encouraged to use Git, create frequent commits, and manually validate generated logic before integrating changes into production systems.

The most effective workflow is iterative. Instead of asking the AI to generate entire games or complete systems in a single prompt, developers should progressively refine systems while continuously validating architecture and behavior. In practice, this produces significantly more stable and maintainable results than attempting fully autonomous generation workflows.

The assistant becomes dramatically more useful when paired with developers who already understand GML architecture, debugging fundamentals, and software structure. It is best viewed as a productivity multiplier rather than a replacement for technical knowledge.

---

# Open Source Nature

This project is fully open source and primarily developed as a personal hobby project rather than a commercial product. The goal is simply to build a genuinely useful engineering tool for GameMaker developers while experimenting with AI-assisted workflows and local inference technologies.

The codebase is not perfect, bugs will exist, and architectural decisions may evolve over time as the project changes. Contributions, pull requests, issue reports, optimization improvements, and general feedback are highly encouraged from anyone interested in Electron applications, inference systems, AI tooling, or GameMaker development workflows.

Because the project is community-oriented and experimental by nature, users should approach it with realistic expectations and understand that stability may vary depending on hardware configuration, inference backend, or project complexity.

---

# Disclaimer

I am not a professional software engineer. This project was created primarily as a personal tool to improve my own GameMaker workflows and later evolved into something worth sharing publicly. While I actively use the application myself, there are certainly areas that can be improved, optimized, or rewritten entirely.

Use the software at your own risk. Always maintain backups and proper version control before allowing any automated system to modify production project files. AI systems are capable of producing incorrect logic, destructive edits, hallucinated APIs, or unstable implementations regardless of how advanced the underlying model may appear.

The assistant should be treated as a development aid, not an infallible authority.

---

# Contributing

Community contributions are welcome and appreciated. Developers interested in React, Electron, Node.js, inference optimization, prompt engineering, retrieval systems, or GameMaker tooling are encouraged to contribute if they find the project interesting or useful.

Bug reports, pull requests, architectural suggestions, performance improvements, and feature ideas all help improve the project over time. The long-term goal is to build a genuinely useful AI-assisted workspace tailored specifically toward GameMaker development instead of generic coding workflows that only partially translate into the realities of GML projects.

---

# License

This project is distributed under the MIT License. You are free to use, modify, distribute, and adapt the software according to the terms of the license.
