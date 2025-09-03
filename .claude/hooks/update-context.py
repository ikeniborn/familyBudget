#!/usr/bin/env python3
import json
import sys
import re
import datetime

# Load input from stdin
try:
    input_data = json.load(sys.stdin)
except json.JSONDecodeError as e:
    print(f"Error: Invalid JSON input: {e}", file=sys.stderr)
    sys.exit(1)

prompt = input_data.get("prompt", "")

# Check for sensitive patterns
sensitive_patterns = [
    (r"(?i)\b(password|secret|key|token)\s*[:=]", "Prompt contains potential secrets"),
]

for pattern, message in sensitive_patterns:
    if re.search(pattern, prompt):
        # Use JSON output to block with a specific reason
        output = {"decision": "block", "reason": f"Security policy violation: {message}. Please rephrase your request without sensitive information."}
        print(json.dumps(output))
        sys.exit(0)

# Add current time to context
context = f"""
<role>
Профессиональный разработчик фронтенд и бэкенд для домашнего учета
</role>
<domain_expertise>
- Modern web development (SvelteKit, TypeScript)
- Database design and optimization (PostgreSQL, FastApi)
- Docker containerization and microservices
- User experience and interface design
</domain_expertise>
<delegation_strategy>
- Делегируй задачи субагентам
- Используй субагнетов: api-developer, code-reviewer, frontend-developer, code-documenter, python-developer, javascript-developer, backend-developer, docker-deployment-expert,typescript-developer, uxui-design-architect,database-designer 
</delegation_strategy>
<operational_rules>
- Используй инструменты: mcp__sgr, mcp__context7, mcp__memory 
- Всегда проверяй существующий код перед изменениями
- Следуй архитектурным паттернам проекта
- Поддерживай консистентность кодовой базы
- Документируй важные решения в /docs
- Создавай и запскай модульные тесты для реализованного или измененного функционала в /test
</operational_rules>
<execution_instructions>
- Для обработки запроса пользователя используй инструмент mcp__sgr
- Следуй схеме последовательно, шаг за шагом
- Фиксируй и используй контрольные точки для валидации с помощью mcp__memory
- При блокировках или проблемах - эскалируй пользователю
- Поддерживай прозрачность процесса через TodoWrite
</execution_instructions>
"""

# The following is also equivalent:
print(
    json.dumps(
        {
            "hookSpecificOutput": {
                "hookEventName": "UserPromptSubmit",
                "additionalContext": context,
            },
        }
    )
)

# Allow the prompt to proceed with the additional context
sys.exit(0)
