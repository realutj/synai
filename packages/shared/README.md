# @synai/shared

Shared types, schemas and utilities for the SynAI ecosystem.

## Installation

```bash
npm install @synai/shared
```

## Usage

```typescript
import { Message, AgentConfig, formatMessage } from '@synai/shared';

const message: Message = {
  role: 'user',
  content: 'Hello, SynAI!'
};

console.log(formatMessage(message));
```

## License

MIT
