# Azure Web PubSub Service SDK Acceptance Criteria

**SDK**: `azure-messaging-webpubsubservice`
**Repository**: https://github.com/Azure/azure-sdk-for-python/tree/main/sdk/webpubsub/azure-messaging-webpubsubservice
**Commit**: `main`
**Purpose**: Skill testing acceptance criteria for validating generated code correctness

---

## 1. Correct Import Patterns

### 1.1 Client Imports

#### ✅ CORRECT: Sync Client
```python
from azure.messaging.webpubsubservice import WebPubSubServiceClient
from azure.identity import DefaultAzureCredential
```

#### ✅ CORRECT: Async Client
```python
from azure.messaging.webpubsubservice.aio import WebPubSubServiceClient
from azure.identity.aio import DefaultAzureCredential
```

### 1.2 Anti-Patterns (ERRORS)

#### ❌ INCORRECT: Wrong module or credential pairing
```python
# WRONG - wrong package name
from azure.messaging.webpubsub import WebPubSubServiceClient

# WRONG - async client with sync credential
from azure.messaging.webpubsubservice.aio import WebPubSubServiceClient
from azure.identity import DefaultAzureCredential
```

---

## 2. Authentication Patterns

### 2.1 ✅ CORRECT: Connection String
```python
import os
from azure.messaging.webpubsubservice import WebPubSubServiceClient

client = WebPubSubServiceClient.from_connection_string(
    connection_string=os.environ["AZURE_WEBPUBSUB_CONNECTION_STRING"],
    hub=os.environ["AZURE_WEBPUBSUB_HUB"],
)
```

### 2.2 ✅ CORRECT: DefaultAzureCredential
```python
import os
from azure.messaging.webpubsubservice import WebPubSubServiceClient
from azure.identity import DefaultAzureCredential

client = WebPubSubServiceClient(
    endpoint=os.environ["AZURE_WEBPUBSUB_ENDPOINT"],
    hub=os.environ["AZURE_WEBPUBSUB_HUB"],
    credential=DefaultAzureCredential(),
)
```

### 2.3 Anti-Patterns (ERRORS)

#### ❌ INCORRECT: Hardcoded connection strings
```python
# WRONG - hardcoded credentials
client = WebPubSubServiceClient.from_connection_string(
    connection_string="Endpoint=https://example.webpubsub.azure.com;AccessKey=...",
    hub="my-hub",
)
```

---

## 3. WebPubSubServiceClient Patterns

### 3.1 ✅ CORRECT: Instantiate from Connection String
```python
import os
from azure.messaging.webpubsubservice import WebPubSubServiceClient

client = WebPubSubServiceClient.from_connection_string(
    connection_string=os.environ["AZURE_WEBPUBSUB_CONNECTION_STRING"],
    hub=os.environ["AZURE_WEBPUBSUB_HUB"],
)
```

### 3.2 ✅ CORRECT: Instantiate with Endpoint + Credential
```python
import os
from azure.messaging.webpubsubservice import WebPubSubServiceClient
from azure.identity import DefaultAzureCredential

client = WebPubSubServiceClient(
    endpoint=os.environ["AZURE_WEBPUBSUB_ENDPOINT"],
    hub=os.environ["AZURE_WEBPUBSUB_HUB"],
    credential=DefaultAzureCredential(),
)
```

### 3.3 Anti-Patterns (ERRORS)

#### ❌ INCORRECT: Missing hub parameter
```python
# WRONG - hub parameter is required when using from_connection_string
# Valid usage requires: hub=os.environ["AZURE_WEBPUBSUB_HUB"]
client = WebPubSubServiceClient.from_connection_string(connection_string=conn_str)
```

---

## 4. Send Messages

### 4.1 ✅ CORRECT: Broadcast to All
```python
client.send_to_all(message="Hello everyone!", content_type="text/plain")

client.send_to_all(
    message={"type": "notification", "data": "Hello"},
    content_type="application/json",
)
```

### 4.2 ✅ CORRECT: Targeted Sends
```python
client.send_to_user(
    user_id="user123",
    message="Hello user!",
    content_type="text/plain",
)

client.send_to_group(
    group="my-group",
    message="Hello group!",
    content_type="text/plain",
)

client.send_to_connection(
    connection_id="abc123",
    message="Hello connection!",
    content_type="text/plain",
)
```

### 4.3 Anti-Patterns (ERRORS)

#### ❌ INCORRECT: Wrong argument names
```python
# WRONG - 'data' is not a valid parameter
client.send_to_all(data="Hello", content_type="text/plain")
```

---

## 5. Groups

### 5.1 ✅ CORRECT: User and Connection Group Management
```python
client.add_user_to_group(group="my-group", user_id="user123")
client.remove_user_from_group(group="my-group", user_id="user123")

client.add_connection_to_group(group="my-group", connection_id="abc123")
client.remove_connection_from_group(group="my-group", connection_id="abc123")
```

### 5.2 Anti-Patterns (ERRORS)

#### ❌ INCORRECT: Wrong parameter names
```python
# WRONG - group_name is not supported
client.add_user_to_group(group_name="my-group", user_id="user123")
```

---

## 6. Connections

### 6.1 ✅ CORRECT: Connection Checks and Close
```python
exists = client.connection_exists(connection_id="abc123")
user_connected = client.user_exists(user_id="user123")
group_has_connections = client.group_exists(group="my-group")

client.close_connection(connection_id="abc123", reason="Session ended")
client.close_user_connections(user_id="user123", reason="Session ended")
```

### 6.2 Anti-Patterns (ERRORS)

#### ❌ INCORRECT: Wrong method for closing a user's connections
```python
# WRONG - close_all_connections does not accept user_id; use close_user_connections instead
client.close_all_connections(user_id="user123")
```

---

## 7. Token Generation

### 7.1 ✅ CORRECT: Generate Client Access Token
```python
token = client.get_client_access_token()
print(token["url"])

token = client.get_client_access_token(
    user_id="user123",
    roles=["webpubsub.sendToGroup", "webpubsub.joinLeaveGroup"],
)

token = client.get_client_access_token(
    user_id="user123",
    groups=["group1", "group2"],
    minutes_to_expire=30,
)
```

### 7.2 Anti-Patterns (ERRORS)

#### ❌ INCORRECT: Wrong parameter names
```python
# WRONG - userId is not a valid parameter
token = client.get_client_access_token(userId="user123")
```
