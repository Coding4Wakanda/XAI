
class MenuManager {
  constructor() {
    this.currentMenu = [];
    this.companyInfo = {
      name: '',
      description: '',
      cuisine: ''
    };
  }

  // Load menu from JSON data
  loadMenu(menuData) {
    if (menuData.company) {
      this.companyInfo = menuData.company;
    }
    
    if (menuData.items && Array.isArray(menuData.items)) {
      this.currentMenu = menuData.items.map(item => ({
        name: item.name || '',
        description: item.description || '',
        price: parseFloat(item.price) || 0,
        category: item.category || 'main',
        dietary: item.dietary || [], // e.g., ['vegan', 'gluten-free']
        ingredients: item.ingredients || [],
        tags: item.tags || [] // e.g., ['spicy', 'protein-rich', 'quick']
      }));
      return true;
    }
    return false;
  }

  // Search menu items by keyword
  searchMenu(query) {
    const searchTerm = query.toLowerCase();
    return this.currentMenu.filter(item => 
      item.name.toLowerCase().includes(searchTerm) ||
      item.description.toLowerCase().includes(searchTerm) ||
      item.category.toLowerCase().includes(searchTerm) ||
      item.dietary.some(diet => diet.toLowerCase().includes(searchTerm)) ||
      item.ingredients.some(ing => ing.toLowerCase().includes(searchTerm)) ||
      item.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    );
  }

  // Get menu by category
  getByCategory(category) {
    return this.currentMenu.filter(item => 
      item.category.toLowerCase() === category.toLowerCase()
    );
  }

  // Get menu by dietary restriction
  getByDietary(dietary) {
    return this.currentMenu.filter(item =>
      item.dietary.some(diet => diet.toLowerCase().includes(dietary.toLowerCase()))
    );
  }

  // Get formatted menu string for AI prompt
  getMenuForAI() {
    const companyName = this.companyInfo.name || 'Restaurant';
    const menuList = this.currentMenu.map(item => {
      const dietary = item.dietary.length > 0 ? ` (${item.dietary.join(', ')})` : '';
      const tags = item.tags.length > 0 ? ` [${item.tags.join(', ')}]` : '';
      return `- ${item.name} ($${item.price.toFixed(2)}): ${item.description}${dietary}${tags}`;
    }).join('\n');

    return {
      companyName,
      menuList,
      companyInfo: this.companyInfo
    };
  }

  // Export current menu
  exportMenu() {
    return {
      company: this.companyInfo,
      items: this.currentMenu
    };
  }
}

module.exports = MenuManager;
