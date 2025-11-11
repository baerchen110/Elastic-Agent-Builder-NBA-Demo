#!/usr/bin/env python3
import os
from dotenv import load_dotenv
from langchain_openai import AzureChatOpenAI
from langchain_core.messages import HumanMessage

load_dotenv()

print("=" * 60)
print("Testing Azure OpenAI Connection")
print("=" * 60)

# Show configuration (without exposing full key)
endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")
api_version = os.getenv("AZURE_OPENAI_API_VERSION")
api_key = os.getenv("AZURE_OPENAI_API_KEY")

print(f"\n✓ Endpoint: {endpoint}")
print(f"✓ Deployment: {deployment}")
print(f"✓ API Version: {api_version}")
print(f"✓ API Key: {api_key[:10]}...{api_key[-5:] if len(api_key) > 15 else 'TOO_SHORT'}")

print("\n[1/3] Creating LLM client...")
try:
    llm = AzureChatOpenAI(
        azure_endpoint=endpoint,
        azure_deployment=deployment,
        api_version=api_version,
        api_key=api_key,
        temperature=0.7,
        timeout=60
    )
    print("✓ LLM client created successfully")
except Exception as e:
    print(f"✗ Failed to create LLM client: {e}")
    exit(1)

print("\n[2/3] Testing simple message...")
try:
    response = llm.invoke([HumanMessage(content="Say 'Hello' and nothing else")])
    print(f"✓ Response: {response.content}")
except Exception as e:
    print(f"✗ Failed: {e}")
    print(f"  Error type: {type(e).__name__}")
    exit(1)

print("\n[3/3] Testing JSON response...")
try:
    response = llm.invoke([HumanMessage(
        content='Respond ONLY with valid JSON: {"test": "value"}'
    )])
    print(f"✓ Response: {response.content}")
except Exception as e:
    print(f"✗ Failed: {e}")
    exit(1)

print("\n" + "=" * 60)
print("✓ All tests passed! Azure OpenAI is configured correctly.")
print("=" * 60)
