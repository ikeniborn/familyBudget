#!/usr/bin/env bash

# Test script for Claude Code hook

echo "=== Testing Claude Code Context Hook ==="
echo ""

# Test 1: Basic execution
echo "Test 1: Basic execution"
echo "------------------------"
output=$(echo "test prompt" | bash ./hooks/add-context.sh 2>&1)
if echo "$output" | grep -q "PROJECT CONTEXT START"; then
    echo "✓ Hook executes successfully"
else
    echo "✗ Hook failed to execute"
    exit 1
fi

# Test 2: Check context sections
echo ""
echo "Test 2: Context sections"
echo "------------------------"
sections=("Git Status" "Docker Containers" "Project Structure")
for section in "${sections[@]}"; do
    if echo "$output" | grep -q "$section"; then
        echo "✓ Section found: $section"
    else
        echo "⚠ Section missing: $section (might be normal if not available)"
    fi
done

# Test 3: User prompt preservation
echo ""
echo "Test 3: User prompt preservation"
echo "------------------------"
test_prompt="This is my test prompt"
result=$(echo "$test_prompt" | bash ./hooks/add-context.sh 2>&1)
if echo "$result" | grep -q "$test_prompt"; then
    echo "✓ User prompt is preserved"
else
    echo "✗ User prompt not preserved"
    exit 1
fi

# Test 4: Error handling
echo ""
echo "Test 4: Error handling"
echo "------------------------"
# Test with non-existent project directory
CLAUDE_PROJECT_DIR="/non/existent/path" bash ./hooks/add-context.sh < /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "✓ Script handles errors correctly"
else
    echo "⚠ Script might not handle all errors"
fi

echo ""
echo "=== All tests completed ==="