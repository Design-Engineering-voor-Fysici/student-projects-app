// Configuration for the Student Projects Frontend
const CONFIG = {
  // Connection mode: 'demo', 'supabase', or 'api'
  MODE: 'local-json', // Self-contained: read from Website/data/projects.json and export changes
  
  // API Base URL - for 'api' mode only
  API_BASE_URL: '', // Empty string means relative URLs (same domain)
  
  // Legacy: Demo mode - kept for backward compatibility
  DEMO_MODE: false,
  
  // Mock data for demo mode
  MOCK_DATA: {
    projects: [
      {
        id: 1,
        title: "Smart Home Automation",
        student_name: "Alice Johnson",
        description: "An IoT-based home automation system using Arduino and sensors to control lights, temperature, and security.",
        year: 2024,
        rating: 5,
        tags: "Arduino, IoT, Sensors, Automation",
        category: "Engineering",
        curator: "Dr. Smith",
        video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        project_link: "https://github.com/alice/smart-home",
        image_count: 3,
        video_count: 1,
        thumbnail_image: "https://via.placeholder.com/400x300/4f46e5/ffffff?text=Smart+Home",
        created_at: "2024-01-15T10:30:00Z",
        media: [
          {
            id: 1,
            media_type: "image",
            filename: "https://via.placeholder.com/400x300/4f46e5/ffffff?text=Smart+Home+Setup",
            original_name: "setup.jpg"
          },
          {
            id: 2,
            media_type: "image", 
            filename: "https://via.placeholder.com/400x300/10b981/ffffff?text=Control+Panel",
            original_name: "control.jpg"
          }
        ]
      },
      {
        id: 2,
        title: "E-commerce Website",
        student_name: "Bob Chen",
        description: "A full-stack e-commerce platform built with React and Node.js, featuring user authentication, shopping cart, and payment processing.",
        year: 2024,
        rating: 4,
        tags: "React, Node.js, MongoDB, Stripe",
        category: "Computer Science",
        curator: "Dr. Johnson",
        project_link: "https://demo-ecommerce.example.com",
        image_count: 2,
        video_count: 0,
        thumbnail_image: "https://via.placeholder.com/400x300/ef4444/ffffff?text=E-commerce",
        created_at: "2024-02-20T14:15:00Z",
        media: [
          {
            id: 3,
            media_type: "image",
            filename: "https://via.placeholder.com/400x300/ef4444/ffffff?text=Homepage",
            original_name: "homepage.png"
          }
        ]
      },
      {
        id: 3,
        title: "Mobile Game App",
        student_name: "Carol Davis",
        description: "An engaging puzzle game developed with Flutter for both iOS and Android platforms.",
        year: 2024,
        rating: 3,
        tags: "Flutter, Dart, Mobile, Gaming",
        category: "Software Development",
        curator: "Dr. Williams",
        video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        image_count: 1,
        video_count: 1,
        thumbnail_image: "https://via.placeholder.com/400x300/8b5cf6/ffffff?text=Mobile+Game",
        created_at: "2024-03-10T09:45:00Z",
        media: [
          {
            id: 4,
            media_type: "image",
            filename: "https://via.placeholder.com/400x300/8b5cf6/ffffff?text=Game+Screenshot",
            original_name: "screenshot.png"
          }
        ]
      },
      {
        id: 4,
        title: "AI Chatbot",
        student_name: "David Wilson",
        description: "An intelligent chatbot using natural language processing to assist students with course questions.",
        year: 2023,
        rating: 5,
        tags: "Python, NLP, AI, Machine Learning",
        category: "Artificial Intelligence",
        curator: "Dr. Brown",
        github_repo: "https://github.com/david/ai-chatbot",
        image_count: 2,
        video_count: 0,
        thumbnail_image: "https://via.placeholder.com/400x300/06b6d4/ffffff?text=AI+Chatbot",
        created_at: "2023-11-05T16:20:00Z",
        media: []
      }
    ]
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
} else {
  window.CONFIG = CONFIG;
}
