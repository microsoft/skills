# Acceptance Criteria: azure-ai-language-conversations-py

## Authentication and Setup

### ✅ Correct
```python
from azure.identity import DefaultAzureCredential
from azure.ai.language.conversations import ConversationAnalysisClient

with ConversationAnalysisClient(endpoint, DefaultAzureCredential()) as client:
    ...
```

### ✅ Correct: legacy key path for existing keyed deployments
```python
from azure.core.credentials import AzureKeyCredential
from azure.ai.language.conversations import ConversationAnalysisClient

with ConversationAnalysisClient(endpoint, AzureKeyCredential(key)) as client:
    ...
```

### ❌ Incorrect
```python
client = ConversationAnalysisClient(endpoint, credential)
# Missing context manager
```

## Payload Construction

### ✅ Correct
```python
task = {
    "kind": "Conversation",
    "analysisInput": {
        "conversationItem": {
            "participantId": "1",
            "id": "1",
            "modality": "text",
            "text": query,
        }
    },
    "parameters": {
        "projectName": project_name,
        "deploymentName": deployment_name,
    },
}
```

### ❌ Incorrect
```python
task = {
    "kind": "conversations",  # Wrong kind
    "parameters": {},
}
```

## API Usage

### ✅ Correct
```python
result = client.analyze_conversation(task=task)
print(result["result"]["prediction"]["topIntent"])
```

### ❌ Incorrect
```python
result = client.analyze(task=task)  # Wrong method name
```
