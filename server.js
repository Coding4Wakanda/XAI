
const express = require('express');
const cors = require('cors');
const path = require('path');
const MenuManager = require('./menu-manager');
const AnalyticsManager = require('./analytics-api');

// Firebase Admin SDK (you'll need to install this)
// npm install firebase-admin
let admin;
try {
  admin = require('firebase-admin');
  // Initialize Firebase Admin with your service account key
  // admin.initializeApp({
  //   credential: admin.credential.applicationDefault(),
  // });
} catch (error) {
  console.log('Firebase Admin not available, using mock auth');
}

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize menu manager and analytics
const menuManager = new MenuManager();
const analyticsManager = new AnalyticsManager();

// Load default menu (CRAV menu) - can be replaced with any company's menu
const defaultMenu = {
  company: {
    name: "CRAV",
    description: "Healthy plant-based meal delivery",
    cuisine: "Plant-based"
  },
  items: [
    { name: "Quinoa Chickpea Bowl", description: "Protein-packed bowl with kale, hummus, and tahini drizzle.", price: 11.99, category: "bowls", dietary: ["vegan", "gluten-free"], tags: ["protein-rich", "healthy"] },
    { name: "Thai Peanut Noodles", description: "Rice noodles in creamy peanut sauce with bok choy and tofu.", price: 12.49, category: "noodles", dietary: ["vegan"], tags: ["asian", "comfort"] },
    { name: "Sweet Potato Buddha Bowl", description: "Roasted sweet potato, black beans, and avocado lime mash.", price: 10.99, category: "bowls", dietary: ["vegan", "gluten-free"], tags: ["sweet", "filling"] },
    { name: "Spicy Lentil Soup", description: "Warming red lentil soup with turmeric and cumin.", price: 9.99, category: "soups", dietary: ["vegan", "gluten-free"], tags: ["spicy", "warming"] },
    { name: "Miso Ginger Stir-Fry", description: "Veggie-packed stir fry with miso-ginger glaze over brown rice.", price: 11.29, category: "stir-fry", dietary: ["vegan"], tags: ["asian", "quick"] },
    { name: "Coconut Curry Chickpeas", description: "Chickpeas in rich coconut curry with jasmine rice.", price: 12.99, category: "curry", dietary: ["vegan", "gluten-free"], tags: ["spicy", "comfort"] }
  ]
};

menuManager.loadMenu(defaultMenu);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Client authentication middleware
async function authenticateClient(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // For development/demo purposes, decode mock token
    // In production, verify with Firebase Admin
    let decodedToken;
    
    if (admin && admin.auth) {
      // Production Firebase verification
      decodedToken = await admin.auth().verifyIdToken(token);
    } else {
      // Mock verification for development
      try {
        decodedToken = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      } catch (e) {
        return res.status(401).json({ error: 'Invalid token format' });
      }
    }
    
    // Extract client ID from custom claims or user data
    const clientId = decodedToken.clientId || decodedToken.client_id || req.headers['x-client-id'];
    
    if (!clientId) {
      return res.status(403).json({ error: 'No client ID found in token' });
    }
    
    req.user = decodedToken;
    req.clientId = clientId;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Invalid authentication token' });
  }
}

// Apply authentication to protected routes
const protectedRoutes = ['/api/analytics', '/api/user'];
protectedRoutes.forEach(route => {
  app.use(route, authenticateClient);
});

// Serve CRAV.html as the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'CRAV.html'));
});

// Keep business version accessible at /business
app.get('/business', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Admin panel for menu management
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Analytics dashboard
app.get('/analytics', (req, res) => {
  res.sendFile(path.join(__dirname, 'analytics-dashboard.html'));
});

// Client dashboard (multi-tenant)
app.get('/client', (req, res) => {
  res.sendFile(path.join(__dirname, 'client-dashboard.html'));
});

// OpenAI configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// API endpoint for OpenAI chat
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    
    // Get user info from Replit Auth headers
    const userId = req.headers['x-replit-user-id'] || 'anonymous-' + Date.now();
    const userName = req.headers['x-replit-user-name'] || 'Guest';
    
    // Get user's past orders and preferences
    const userHistory = analyticsManager.getUserHistory(userId);
    
    // Get current menu data
    const { companyName, menuList, companyInfo } = menuManager.getMenuForAI();
    
    // If OpenAI API key is available, use AI
    if (OPENAI_API_KEY) {
      // Build conversation with system message first
      const conversationMessages = [
        { 
          role: 'system', 
          content: `You are ${companyName} AI, a meal planning assistant for ${companyName}. ${companyInfo.description ? companyInfo.description + '. ' : ''}You only recommend meals from this specific menu:

${menuList}

USER CONTEXT:
- User: ${userName}
- Past orders: ${userHistory.pastOrders.length > 0 ? userHistory.pastOrders.map(order => order.items?.join(', ') || 'Unknown items').join(' | ') : 'None yet'}
- Favorite items: ${userHistory.favoriteItems.length > 0 ? userHistory.favoriteItems.join(', ') : 'None identified yet'}
- Dietary preferences noted: ${userHistory.dietaryPreferences.length > 0 ? userHistory.dietaryPreferences.join(', ') : 'None noted yet'}
- Total orders: ${userHistory.totalOrders}
- Last order: ${userHistory.lastOrderDate ? new Date(userHistory.lastOrderDate).toLocaleDateString() : 'Never'}

IMPORTANT RULES:
- Only recommend meals that exist in the above menu
- Never create or suggest new meals not on this list
- Use the user's past orders and preferences to make personalized recommendations
- If this is a returning customer, acknowledge their previous choices and suggest similar items or new items they might like
- When users ask for specific dietary needs, find matching items and remember their preferences for future conversations
- Pay attention to dietary labels in parentheses and tags in brackets
- Explain why each recommended meal fits their request and relate to their past preferences when relevant
- If no perfect match exists, recommend the closest options and explain
- Keep responses concise and helpful but personalized
- Remember previous context in our conversation and their order history
- Match customer cravings with menu items based on ingredients, flavors, cooking styles, and past behavior
- Be friendly and acknowledge their loyalty if they're a repeat customer` 
        },
        ...messages
      ];
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: conversationMessages,
          max_tokens: 500,
          temperature: 0.7
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'OpenAI API error');
      }

      const aiResponse = data.choices[0].message.content;
      
      // Extract mentioned menu items for auto cart
      const mentionedItems = [];
      menuManager.currentMenu.forEach(item => {
        if (aiResponse.toLowerCase().includes(item.name.toLowerCase())) {
          mentionedItems.push({
            name: item.name,
            price: item.price,
            description: item.description
          });
        }
      });
      
      // Track the conversation for analytics with client ID
      const clientId = req.headers['x-client-id'] || req.clientId;
      analyticsManager.trackConversation(
        userId, 
        messages[messages.length - 1].content, 
        aiResponse,
        mentionedItems.map(item => item.name),
        clientId
      );
      
      return res.json({ 
        response: aiResponse,
        menuItems: mentionedItems // Send detected menu items for auto cart
      });
    }
    
    // Fallback responses when no API key is available
    const lastMessage = messages[messages.length - 1]?.content.toLowerCase() || '';
    
    let response = '';
    
    if (lastMessage.includes('spicy') || lastMessage.includes('hot')) {
      response = "For something spicy, I recommend the Spicy Lentil Soup or the Chili Lime Cauliflower! Both have great heat and flavor.";
    } else if (lastMessage.includes('protein') || lastMessage.includes('muscle')) {
      response = "For high protein options, try the Quinoa Chickpea Bowl or the Tempeh Power Plate - both are packed with plant-based protein!";
    } else if (lastMessage.includes('quick') || lastMessage.includes('fast')) {
      response = "For quick meals, I suggest the Tofu Scramble Bowl or the Avocado Kale Pasta - both are ready in no time!";
    } else if (lastMessage.includes('soup') || lastMessage.includes('warm')) {
      response = "Perfect for something warm! Try our Spicy Lentil Soup or the Alkaline Green Soup - both are comforting and nutritious.";
    } else if (lastMessage.includes('sweet')) {
      response = "For something with natural sweetness, the Sweet Potato Buddha Bowl or Coconut Millet Porridge are delicious options!";
    } else {
      response = "I'd love to help you find the perfect meal! Try telling me about your cravings - are you looking for something spicy, protein-packed, quick, or maybe something specific like soup or pasta?";
    }
    
    res.json({ response });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: 'Failed to get AI response. Please try again.' 
    });
  }
});

// Menu management endpoints
app.post('/api/menu/upload', (req, res) => {
  try {
    const menuData = req.body;
    const success = menuManager.loadMenu(menuData);
    
    if (success) {
      res.json({ 
        success: true, 
        message: `Menu loaded successfully for ${menuManager.companyInfo.name}`,
        itemCount: menuManager.currentMenu.length 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid menu format' 
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to upload menu: ' + error.message 
    });
  }
});

app.get('/api/menu/current', (req, res) => {
  res.json(menuManager.exportMenu());
});

app.get('/api/menu/search/:query', (req, res) => {
  const results = menuManager.searchMenu(req.params.query);
  res.json(results);
});

// Analytics API endpoints
app.get('/api/analytics/dashboard/:timeRange?', (req, res) => {
  const timeRange = req.params.timeRange || '24h';
  const clientId = req.clientId;
  const analyticsData = analyticsManager.getAnalytics(timeRange, clientId);
  res.json(analyticsData);
});

// Client management endpoints
app.post('/api/admin/clients', authenticateClient, (req, res) => {
  // Only super admin can create clients
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  
  const { clientId, clientData } = req.body;
  analyticsManager.initializeClient(clientId, clientData);
  res.json({ success: true, clientId });
});

app.get('/api/admin/clients/:clientId', authenticateClient, (req, res) => {
  const clientId = req.params.clientId;
  
  // Users can only access their own client data
  if (req.clientId !== clientId && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  const clientProfile = analyticsManager.getClientProfile(clientId);
  if (!clientProfile) {
    return res.status(404).json({ error: 'Client not found' });
  }
  
  res.json(clientProfile);
});

app.post('/api/analytics/track/cart', (req, res) => {
  const { userId, items, totalValue, eventType } = req.body;
  analyticsManager.trackCartEvent(userId, items, totalValue, eventType);
  res.json({ success: true });
});

app.post('/api/analytics/track/menu', (req, res) => {
  const { userId, itemName, action } = req.body;
  analyticsManager.trackMenuInteraction(userId, itemName, action);
  res.json({ success: true });
});

// User profile and history endpoints
app.get('/api/user/profile', (req, res) => {
  const userId = req.headers['x-replit-user-id'] || req.user.uid;
  const userName = req.headers['x-replit-user-name'] || req.user.name;
  const clientId = req.clientId;
  
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  const userHistory = analyticsManager.getUserHistory(userId, clientId);
  res.json({
    userId,
    userName,
    clientId,
    ...userHistory
  });
});

app.post('/api/user/order', (req, res) => {
  const userId = req.headers['x-replit-user-id'];
  const { items, totalValue, preferences } = req.body;
  
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  analyticsManager.recordOrder(userId, items, totalValue, preferences);
  res.json({ success: true });
});

// Widget endpoint
app.get('/widget.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'widget.html'));
});

app.get('/widget-embed.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, 'widget-embed.js'));
});

// Serve the HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'CRAV.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🥑 CRAV server running on port ${PORT}`);
  console.log(`📦 Widget available at: http://0.0.0.0:${PORT}/widget.html`);
  console.log(`🔗 Embed script at: http://0.0.0.0:${PORT}/widget-embed.js`);
});
