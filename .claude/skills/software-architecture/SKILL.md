---
name: software-architecture
description: Guide for quality focused software architecture (Clean Architecture and Domain Driven Design). Use when designing architecture, structuring modules, or deciding where code belongs in the EOS frontend or backend.
---

# Software Architecture Development Skill

Guidance for quality focused software development and architecture, based on Clean Architecture and Domain Driven Design principles.
Adapted from the aitmpl `software-architecture` skill; the line-count limits, the "arrow functions only" rule and the "always search npm first" rule were removed because they conflict with this codebase and with the `clean-code` skill.

## Code Style Rules

- **Early return pattern**: prefer early returns over nested conditions.
- Avoid code duplication by extracting reusable functions and modules.
- Follow the style already used in the file you are editing (function declarations vs arrow functions, naming, formatting).

## Best Practices

### Dependencies

- Prefer what is already in `package.json` over writing a custom util for the same job.
- **Ask before adding a new dependency.**
- Custom code is justified for domain-specific business logic, performance-critical paths, security-sensitive code needing full control, or when a dependency would be overkill.
- Every line of custom code is a liability that needs maintenance and tests.

### Architecture and Design

- **Clean Architecture & DDD:**
  - Use domain-driven design and a ubiquitous language
  - Separate domain entities from infrastructure concerns
  - Keep business logic independent of frameworks
  - Define use cases clearly and keep them isolated
- **Naming:**
  - Prefer domain-specific names (`OrderCalculator`, `InvoiceGenerator`) over dumping-ground files (a `utils` or `helpers` file with many unrelated functions)
  - Each module should have a single, clear purpose
- **Separation of concerns:**
  - Do NOT mix business logic with UI components
  - Keep database queries out of controllers (controller -> service -> repository)
  - Maintain clear boundaries between contexts

### Anti-Patterns to Avoid

- Mixing business logic with UI components
- Database queries directly in controllers
- Building custom auth, state management or form validation when the project already has an established solution
- A single file that collects unrelated functions with no clear purpose

### Code Quality

- Proper error handling with typed catch blocks
- Break complex logic into smaller, reusable functions
- Avoid deep nesting
- Keep functions and files focused on one responsibility
