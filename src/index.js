import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes/index.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Welcome to the Accounting AI API');
});

// Routes
app.use('/api/v2', apiRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// import ConversationManager from './services/conversation-manager.js';

// async function initializeDatabase() {
//   console.log('🚀 Initializing conversation database tables...');
  
//   const conversationManager = new ConversationManager();
  
//   try {
//     await conversationManager.initDatabase();
//     console.log('✅ Database initialization completed successfully!');
//     console.log('');
//     console.log('Tables created:');
//     console.log('  - conversations');
//     console.log('  - messages');
//     console.log('  - pending_confirmations');
//     console.log('');
//     console.log('You can now start your server!');
//     process.exit(0);
//   } catch (error) {
//     console.error('❌ Database initialization failed:', error);
//     process.exit(1);
//   }
// }

// initializeDatabase();

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📡 API endpoint: http://localhost:${PORT}/api/chat`);
});