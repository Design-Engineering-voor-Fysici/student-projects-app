// Standalone version of main.js that works without Flask backend
// Load configuration - wait for it to be available
let config = window.CONFIG || { MODE: 'demo', DEMO_MODE: true };

const state = {
  sort: 'title',
  order: 'asc',
  randomMode: false,
  allProjects: [],
  commentsViewMode: false,
};

// Mock API functions for demo mode
const mockAPI = {
  async fetchProjects(params = {}) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    let projects = [...config.MOCK_DATA.projects];
    
    // Apply filters
    if (params.q) {
      const query = params.q.toLowerCase();
      projects = projects.filter(p => 
        p.title.toLowerCase().includes(query) ||
        p.student_name.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query)) ||
        (p.tags && p.tags.toLowerCase().includes(query))
      );
    }
    
    if (params.year) {
      projects = projects.filter(p => p.year && p.year.toString() === params.year);
    }
    
    if (params.curator) {
      projects = projects.filter(p => p.curator === params.curator);
    }
    
    // Apply sorting
    const sortField = params.sort || 'title';
    const sortOrder = params.order || 'asc';
    
    projects.sort((a, b) => {
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';
      
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      
      if (sortOrder === 'desc') {
        return bVal > aVal ? 1 : -1;
      } else {
        return aVal > bVal ? 1 : -1;
      }
    });
    
    return projects;
  },
  
  async createProject(projectData) {
    await new Promise(resolve => setTimeout(resolve, 500));
    const newProject = {
      id: Math.max(...config.MOCK_DATA.projects.map(p => p.id)) + 1,
      ...projectData,
      created_at: new Date().toISOString(),
      image_count: 0,
      video_count: 0,
      media: []
    };
    config.MOCK_DATA.projects.push(newProject);
    return newProject;
  },
  
  async getProject(id) {
    await new Promise(resolve => setTimeout(resolve, 200));
    return config.MOCK_DATA.projects.find(p => p.id === parseInt(id));
  },
  
  async deleteProject(id) {
    await new Promise(resolve => setTimeout(resolve, 300));
    const index = config.MOCK_DATA.projects.findIndex(p => p.id === parseInt(id));
    if (index !== -1) {
      config.MOCK_DATA.projects.splice(index, 1);
    }
  }
};

// Supabase API handler
async function handleSupabaseCall(endpoint, options = {}) {
  if (!window.supabaseAPI) {
    throw new Error('Local JSON client not loaded. Please include local-json-client.js');
  }
  
  console.log('Local/API compatibility mode: Calling', endpoint);
  
  // Parse endpoint and method
  const method = options.method || 'GET';
  const url = new URL(endpoint, window.location.origin);
  const params = Object.fromEntries(url.searchParams);
  
  try {
    if (endpoint.match(/\/api\/projects\/\d+$/) && method === 'GET') {
      const id = endpoint.split('/').pop();
      return await window.supabaseAPI.getProject(id);
    } else if (endpoint.match(/\/api\/projects\/\d+$/) && method === 'PUT') {
      const id = endpoint.split('/').pop();
      const data = options.body ? JSON.parse(options.body) : {};
      return await window.supabaseAPI.updateProject(id, data);
    } else if (endpoint.match(/\/api\/projects\/\d+$/) && method === 'DELETE') {
      const id = endpoint.split('/').pop();
      await window.supabaseAPI.deleteProject(id);
      return {};
    } else if (endpoint.match(/\/api\/projects\/\d+\/comments$/) && method === 'GET') {
      const id = endpoint.match(/\/api\/projects\/(\d+)\/comments$/)[1];
      return await window.supabaseAPI.getComments(id);
    } else if (endpoint.match(/\/api\/projects\/\d+\/comments$/) && method === 'POST') {
      const id = endpoint.match(/\/api\/projects\/(\d+)\/comments$/)[1];
      const data = options.body ? JSON.parse(options.body) : {};
      return await window.supabaseAPI.addComment(id, data);
    } else if (endpoint === '/api/projects' && method === 'GET') {
      return await window.supabaseAPI.fetchProjects(params);
    } else if (endpoint === '/api/projects' && method === 'POST') {
      const data = options.body ? JSON.parse(options.body) : {};
      return await window.supabaseAPI.createProject(data);
    } else if (endpoint.includes('/upload/image') && method === 'POST') {
      const projectId = endpoint.match(/\/api\/projects\/(\d+)\//)?.[1];
      const formData = options.body;
      const file = formData.get('file');
      if (file && projectId) {
        return await window.supabaseAPI.uploadAndAddImage(file, projectId);
      }
      throw new Error('Invalid upload request');
    } else if (endpoint.includes('/upload/video') && method === 'POST') {
      const projectId = endpoint.match(/\/api\/projects\/(\d+)\//)?.[1];
      const formData = options.body;
      const file = formData.get('file');
      if (file && projectId) {
        return await window.supabaseAPI.uploadAndAddVideo(file, projectId);
      }
      throw new Error('Invalid upload request');
    } else if (endpoint.match(/\/api\/media\/\d+$/) && method === 'DELETE') {
      // Media deletion not supported in bucket-only mode
      console.warn('Media deletion endpoint called but not supported in bucket-only mode');
      return {};
    }
    
    // Default empty response for unhandled endpoints
    console.warn('Unhandled Supabase endpoint:', endpoint);
    return {};
  } catch (error) {
    console.error('Supabase API error:', error);
    throw error;
  }
}

// API wrapper that uses different backends based on configuration
async function apiCall(endpoint, options = {}) {
  const mode = config.MODE || (config.DEMO_MODE ? 'demo' : 'api');
  
  if (mode === 'supabase' || mode === 'local-json') {
    return await handleSupabaseCall(endpoint, options);
  } else if (mode === 'demo') {
    console.log('Demo mode: Using mock data for', endpoint);
    
    // Parse endpoint and method
    const method = options.method || 'GET';
    const url = new URL(endpoint, window.location.origin);
    const params = Object.fromEntries(url.searchParams);
    
    if (endpoint.includes('/api/projects') && method === 'GET') {
      return mockAPI.fetchProjects(params);
    } else if (endpoint.includes('/api/projects') && method === 'POST') {
      const data = options.body ? JSON.parse(options.body) : {};
      return mockAPI.createProject(data);
    } else if (endpoint.match(/\/api\/projects\/\d+$/) && method === 'GET') {
      const id = endpoint.split('/').pop();
      return mockAPI.getProject(id);
    } else if (endpoint.match(/\/api\/projects\/\d+$/) && method === 'DELETE') {
      const id = endpoint.split('/').pop();
      await mockAPI.deleteProject(id);
      return {};
    }
    
    // Default empty response
    return {};
  } else {
    // Real API call
    const baseUrl = config.API_BASE_URL || '';
    const response = await fetch(baseUrl + endpoint, options);
    return response.json();
  }
}

async function fetchProjects() {
  try {
    console.log('fetchProjects called');
    
    // Get all projects first
    let allProjects;
    if ((config.MODE === 'supabase' || config.MODE === 'local-json')) {
      allProjects = await window.supabaseAPI.fetchProjects();
    } else {
      allProjects = await apiCall('/api/projects');
    }
    
    console.log('Fetched', allProjects.length, 'total projects');
    
    // Apply client-side filtering
    const filteredData = applyFilters(allProjects);
    console.log('After filtering:', filteredData.length, 'projects');
    
    // Update filter results display
    updateFilterResults(filteredData.length, allProjects.length);
    
    // Store all projects for filter options
    state.allProjects = allProjects;
    
  if (state.randomMode) {
    console.log('Showing random projects');
    showRandomProjects();
  } else {
    console.log('Showing filtered projects');
    if (state.commentsViewMode) {
      displayCommentsView(filteredData);
    } else {
      displayProjects(filteredData);
    }
  }
  
  populateFilterOptions();
  updateActiveFilters();
  } catch (error) {
    console.error('Error fetching projects:', error);
    // Show error message to user
    const projectGrid = document.getElementById('projectGrid');
    if (projectGrid) {
      projectGrid.innerHTML = `
        <div class="error-message" style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: #ef4444;">
          <h3>Failed to load projects</h3>
          <p>Error: ${error.message}</p>
          <button onclick="fetchProjects()" class="btn btn-primary">Try Again</button>
        </div>
      `;
    }
  }
}

function applyFilters(projects) {
  let filtered = [...projects];
  
  // Get filter values
  const search = document.getElementById('search').value.trim().toLowerCase();
  const year = document.getElementById('year').value.trim();
  const curator = document.getElementById('curator').value.trim();
  const category = document.getElementById('category').value.trim();
  const rating = document.getElementById('rating').value.trim();
  const sortBy = document.getElementById('sortBy').value.trim();
  
  // Get quick filter states
  const hasMedia = document.getElementById('filterHasMedia').classList.contains('active');
  const noMedia = document.getElementById('filterNoMedia').classList.contains('active');
  const hasVideo = document.getElementById('filterHasVideo').classList.contains('active');
  const noVideo = document.getElementById('filterNoVideo').classList.contains('active');
  const hasLinks = document.getElementById('filterHasLinks').classList.contains('active');
  const hasComments = document.getElementById('filterHasComments').classList.contains('active');
  
  // Apply search filter
  if (search) {
    filtered = filtered.filter(project => 
      (project.title && project.title.toLowerCase().includes(search)) ||
      (project.student_name && project.student_name.toLowerCase().includes(search)) ||
      (project.description && project.description.toLowerCase().includes(search)) ||
      (project.tags && project.tags.toLowerCase().includes(search))
    );
  }
  
  // Apply year filter
  if (year) {
    filtered = filtered.filter(project => project.year == year);
  }
  
  // Apply curator filter
  if (curator) {
    filtered = filtered.filter(project => project.curator === curator);
  }
  
  // Apply category filter
  if (category) {
    filtered = filtered.filter(project => 
      project.categories && Array.isArray(project.categories) && project.categories.includes(category)
    );
  }
  
  // Apply rating filter
  if (rating) {
    const minRating = parseInt(rating);
    filtered = filtered.filter(project => project.rating >= minRating);
  }
  
  // Apply quick filters
  if (hasMedia) {
    filtered = filtered.filter(project => 
      (project.image_urls && project.image_urls.length > 0) || 
      (project.video_urls && project.video_urls.length > 0) ||
      project.video_url
    );
  }
  
  if (noMedia) {
    filtered = filtered.filter(project => 
      (!project.image_urls || project.image_urls.length === 0) && 
      (!project.video_urls || project.video_urls.length === 0) &&
      !project.video_url
    );
  }
  
  if (hasVideo) {
    filtered = filtered.filter(project => 
      (project.video_urls && project.video_urls.length > 0) ||
      project.video_url
    );
  }
  
  if (noVideo) {
    filtered = filtered.filter(project => 
      (!project.video_urls || project.video_urls.length === 0) &&
      !project.video_url
    );
  }
  
  if (hasLinks) {
    filtered = filtered.filter(project => 
      project.project_link || project.github_repo || project.documentation
    );
  }
  
  if (hasComments) {
    filtered = filtered.filter(project => 
      project.comment_count && project.comment_count > 0
    );
  }
  
  // Apply sorting
  if (sortBy) {
    const [field, order] = sortBy.split('_');
    filtered.sort((a, b) => {
      let aVal = a[field] || '';
      let bVal = b[field] || '';
      
      // Handle different data types
      if (field === 'year' || field === 'rating') {
        aVal = parseInt(aVal) || 0;
        bVal = parseInt(bVal) || 0;
      } else if (field === 'created') {
        aVal = new Date(a.created_at || 0);
        bVal = new Date(b.created_at || 0);
      } else {
        aVal = aVal.toString().toLowerCase();
        bVal = bVal.toString().toLowerCase();
      }
      
      if (aVal < bVal) return order === 'asc' ? -1 : 1;
      if (aVal > bVal) return order === 'asc' ? 1 : -1;
      return 0;
    });
  }
  
  return filtered;
}

function updateFilterResults(filteredCount, totalCount) {
  const resultsElement = document.getElementById('filterResults');
  if (filteredCount === totalCount) {
    resultsElement.textContent = `Showing all ${totalCount} projects`;
  } else {
    resultsElement.textContent = `Showing ${filteredCount} of ${totalCount} projects`;
  }
}

function updateActiveFilters() {
  const activeFilters = [];
  
  // Check all filter inputs for active values
  const search = document.getElementById('search').value.trim();
  const year = document.getElementById('year').value.trim();
  const curator = document.getElementById('curator').value.trim();
  const category = document.getElementById('category').value.trim();
  const rating = document.getElementById('rating').value.trim();
  
  if (search) activeFilters.push({ type: 'search', value: search, label: `Search: "${search}"` });
  if (year) activeFilters.push({ type: 'year', value: year, label: `Year: ${year}` });
  if (curator) activeFilters.push({ type: 'curator', value: curator, label: `Editor: ${curator}` });
  if (category) activeFilters.push({ type: 'category', value: category, label: `Category: ${category}` });
  if (rating) activeFilters.push({ type: 'rating', value: rating, label: `Rating: ${rating}+ stars` });
  
  // Check quick filters
  if (document.getElementById('filterHasMedia').classList.contains('active')) {
    activeFilters.push({ type: 'quick', value: 'has-media', label: 'With Media' });
  }
  if (document.getElementById('filterNoMedia').classList.contains('active')) {
    activeFilters.push({ type: 'quick', value: 'no-media', label: 'No Media' });
  }
  if (document.getElementById('filterHasVideo').classList.contains('active')) {
    activeFilters.push({ type: 'quick', value: 'has-video', label: 'With Video' });
  }
  if (document.getElementById('filterNoVideo').classList.contains('active')) {
    activeFilters.push({ type: 'quick', value: 'no-video', label: 'No Video' });
  }
  if (document.getElementById('filterHasLinks').classList.contains('active')) {
    activeFilters.push({ type: 'quick', value: 'has-links', label: 'With Links' });
  }
  if (document.getElementById('filterHasComments').classList.contains('active')) {
    activeFilters.push({ type: 'quick', value: 'has-comments', label: 'With Comments' });
  }
  
  // Update active filters display
  const activeFiltersContainer = document.getElementById('activeFilters');
  const activeFiltersList = document.getElementById('activeFiltersList');
  
  if (activeFilters.length > 0) {
    activeFiltersList.innerHTML = activeFilters.map(filter => `
      <div class="active-filter-item">
        ${filter.label}
        <span class="active-filter-remove" onclick="removeActiveFilter('${filter.type}', '${filter.value}')">×</span>
      </div>
    `).join('');
    activeFiltersContainer.style.display = 'block';
  } else {
    activeFiltersContainer.style.display = 'none';
  }
}

function removeActiveFilter(type, value) {
  if (type === 'search') {
    document.getElementById('search').value = '';
  } else if (type === 'quick') {
    if (value === 'has-media') document.getElementById('filterHasMedia').classList.remove('active');
    if (value === 'no-media') document.getElementById('filterNoMedia').classList.remove('active');
    if (value === 'has-video') document.getElementById('filterHasVideo').classList.remove('active');
    if (value === 'no-video') document.getElementById('filterNoVideo').classList.remove('active');
    if (value === 'has-links') document.getElementById('filterHasLinks').classList.remove('active');
    if (value === 'has-comments') document.getElementById('filterHasComments').classList.remove('active');
  } else {
    document.getElementById(type).value = '';
  }
  
  fetchProjects();
}

function clearAllFilters() {
  document.getElementById('search').value = '';
  document.getElementById('year').value = '';
  document.getElementById('curator').value = '';
  document.getElementById('category').value = '';
  document.getElementById('rating').value = '';
  document.getElementById('sortBy').value = 'title_asc';
  
  // Clear quick filters
  document.getElementById('filterHasMedia').classList.remove('active');
  document.getElementById('filterNoMedia').classList.remove('active');
  document.getElementById('filterHasVideo').classList.remove('active');
  document.getElementById('filterNoVideo').classList.remove('active');
  document.getElementById('filterHasLinks').classList.remove('active');
  document.getElementById('filterHasComments').classList.remove('active');
  
  fetchProjects();
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function displayProjects(projects) {
  const container = document.getElementById('projectGrid');
  const commentsView = document.getElementById('commentsView');
  
  // Show grid, hide comments view
  container.style.display = 'grid';
  commentsView.style.display = 'none';
  
  if (!projects || projects.length === 0) {
    container.innerHTML = `
      <div class="no-results">
        <div class="no-results-icon">🔍</div>
        <div class="no-results-text">No projects found</div>
        <div class="no-results-subtitle">Try adjusting your search or filters</div>
      </div>
    `;
    return;
  }

  container.innerHTML = projects.map(project => createProjectCard(project)).join('');
}

async function displayCommentsView(projects) {
  const container = document.getElementById('projectGrid');
  const commentsView = document.getElementById('commentsView');
  
  // Hide grid, show comments view
  container.style.display = 'none';
  commentsView.style.display = 'block';
  
  if (!projects || projects.length === 0) {
    commentsView.innerHTML = `
      <div class="no-results">
        <div class="no-results-icon">🔍</div>
        <div class="no-results-text">No projects found</div>
        <div class="no-results-subtitle">Try adjusting your search or filters</div>
      </div>
    `;
    return;
  }

  // Show loading state
  commentsView.innerHTML = `
    <div class="comments-view-loading">
      <div class="loading-spinner"></div>
      <p>Loading comments for ${projects.length} projects...</p>
    </div>
  `;

  // Performance tracking
  const startTime = performance.now();

  // Fetch ALL comments for ALL projects in ONE query - much faster!
  const projectIds = projects.map(p => p.id);
  let allComments = [];
  
  try {
    // Fetch all comments at once using direct Supabase query
    if (window.ENV && window.ENV.SUPABASE_URL) {
      const supabaseUrl = window.ENV.SUPABASE_URL;
      const supabaseKey = window.ENV.SUPABASE_ANON_KEY;
      const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
      
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .in('project_id', projectIds)
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        allComments = data;
      } else if (error) {
        console.error('Supabase error:', error);
      }
    }
  } catch (error) {
    console.error('Error loading comments:', error);
  }
  
  // Group comments by project_id for quick lookup
  const commentsByProject = {};
  allComments.forEach(comment => {
    if (!commentsByProject[comment.project_id]) {
      commentsByProject[comment.project_id] = [];
    }
    commentsByProject[comment.project_id].push(comment);
  });
  
  const loadTime = performance.now() - startTime;
  console.log(`✅ Loaded ${allComments.length} comments for ${projects.length} projects in ${loadTime.toFixed(0)}ms`);

  // Create HTML for each project with comments
  let html = '<div class="comments-view-grid">';
  
  for (const project of projects) {
    html += createProjectWithComments(project, commentsByProject[project.id] || []);
  }
  
  html += '</div>';
  commentsView.innerHTML = html;
}

function createProjectWithComments(project, comments = []) {
  const mediaHtml = createMediaHtml(project);
  const categoriesHtml = project.categories && project.categories.length > 0 
    ? `<div class="cv-categories">${project.categories.slice(0, 3).map(cat => 
        `<span class="cv-category-badge category-${getCategorySlug(cat)}">${escapeHtml(cat)}</span>`
      ).join('')}</div>`
    : '';
  
  const commentsHtml = comments.length > 0
    ? comments.map(comment => createCommentHTML(comment)).join('')
    : '<div class="cv-no-comments">No comments yet</div>';
  
  return `
    <div class="cv-project-card" data-project-id="${project.id}">
      <div class="cv-header" onclick="openProjectModal(${project.id})">
        <div class="cv-media">
          ${mediaHtml}
        </div>
        <div class="cv-info">
          <h3 class="cv-title">${escapeHtml(project.title)}</h3>
          ${categoriesHtml}
          <div class="cv-meta">
            ${project.curator ? `<span class="cv-curator">${escapeHtml(project.curator)}</span>` : ''}
            ${project.year ? `<span class="cv-year">${project.year}</span>` : ''}
            ${project.rating ? `<span class="cv-rating">${'★'.repeat(project.rating)}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="cv-comments">
        <div class="cv-comments-header">
          <span class="cv-comments-count">${comments.length} ${comments.length === 1 ? 'Comment' : 'Comments'}</span>
        </div>
        <div class="cv-comments-list">
          ${commentsHtml}
        </div>
      </div>
    </div>
  `;
}

function createProjectCard(project) {
  const mediaHtml = createMediaHtml(project);
  
  // Create compact metadata for square tiles
  const metadataItems = [];
  if (project.student_name) metadataItems.push(escapeHtml(project.student_name));
  if (project.year) {
    const hasVideo = (project.video_urls && project.video_urls.length > 0) || project.video_url;
    const yearWithVideo = hasVideo ? `${project.year} 🎬` : project.year;
    metadataItems.push(yearWithVideo);
  }
  if (project.curator) metadataItems.push(escapeHtml(project.curator));
  
  const ratingHtml = project.rating ? `<div class="card-rating"><span class="stars">${'★'.repeat(project.rating)}${'☆'.repeat(5-project.rating)}</span></div>` : '';
  
  // Create categories HTML for card
  let categoriesHtml = '';
  if (project.categories && project.categories.length > 0) {
    const displayCategories = project.categories.slice(0, 2); // Show max 2 categories on card
    const moreCount = project.categories.length - 2;
    categoriesHtml = `
      <div class="card-categories">
        ${displayCategories.map(cat => `<span class="card-category-badge category-${getCategorySlug(cat)}" onclick="filterByCategory('${escapeHtml(cat)}'); event.stopPropagation();">${escapeHtml(cat)}</span>`).join('')}
        ${moreCount > 0 ? `<span class="card-category-more">+${moreCount}</span>` : ''}
      </div>
    `;
  }
  
  return `
    <div class="card" data-project-id="${project.id}" onclick="openProjectModal(${project.id})">
      <div class="card-image">
        ${mediaHtml}
        ${ratingHtml}
      </div>
      <div class="card-content">
        <h3 class="card-title">${escapeHtml(project.title)}</h3>
        ${categoriesHtml}
        <div class="card-meta">
          ${metadataItems.map(item => `<span>${item}</span>`).join('')}
        </div>
      </div>
    </div>
  `;
}

function createMediaHtml(project) {
  // Priority: image_urls array, then video_urls array, then video_url (external), then default
  if (project.image_urls && project.image_urls.length > 0) {
    // Show first image from array
    return `<div class="card-media"><img src="${escapeHtml(project.image_urls[0])}" alt="${escapeHtml(project.title)}" loading="lazy" /></div>`;
  } else if (project.video_urls && project.video_urls.length > 0) {
    // Show first video from array as thumbnail
    const videoUrl = project.video_urls[0];
    if (videoUrl.includes('/storage/v1/object/public/')) {
      // It's an uploaded video file - show as static thumbnail (first frame)
      return `
        <div class="card-media">
          <video 
            src="${escapeHtml(videoUrl)}" 
            preload="metadata"
            muted
            style="width: 100%; height: 100%; object-fit: cover; pointer-events: none;"
          >
            Your browser does not support the video tag.
          </video>
        </div>`;
    } else {
      // It's an external video URL - show placeholder with link
      return `
        <div class="card-media video-placeholder">
          <div class="video-icon">🎥</div>
          <div class="video-text">Video Link</div>
        </div>`;
    }
  } else {
    return `<div class="card-media placeholder"><div class="placeholder-icon">📁</div><div class="placeholder-text">No Media</div></div>`;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Get category slug for CSS class
function getCategorySlug(category) {
  return category.toLowerCase().replace(/\s+/g, '-').replace(/&/g, 'and');
}

// Filter projects by category when category badge is clicked
function filterByCategory(category) {
  console.log('Filtering by category:', category);
  
  // Set the category filter
  const categorySelect = document.getElementById('category');
  if (categorySelect) {
    categorySelect.value = category;
  }
  
  // Disable random mode if active
  state.randomMode = false;
  const randomBtn = document.getElementById('randomProjects');
  if (randomBtn) {
    randomBtn.textContent = '🎲 Show me 4 random projects';
    randomBtn.classList.remove('showing-all');
  }
  
  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  // Apply filters
  fetchProjects();
}

function showRandomProjects() {
  if (state.allProjects.length === 0) return;
  
  const shuffled = [...state.allProjects].sort(() => 0.5 - Math.random());
  const randomProjects = shuffled.slice(0, 4);
  
  displayProjects(randomProjects);
}

function populateFilterOptions() {
  // Populate year filter
  const years = [...new Set(state.allProjects.map(p => p.year).filter(Boolean))].sort((a, b) => b - a);
  const yearSelect = document.getElementById('year');
  const currentYear = yearSelect.value;
  yearSelect.innerHTML = '<option value="">All Years</option>' + 
    years.map(year => `<option value="${year}" ${year.toString() === currentYear ? 'selected' : ''}>${year}</option>`).join('');
  
  // Populate curator filter
  const curators = [...new Set(state.allProjects.map(p => p.curator).filter(Boolean))].sort();
  const curatorSelect = document.getElementById('curator');
  const currentCurator = curatorSelect.value;
  curatorSelect.innerHTML = '<option value="">All Editors</option>' + 
    curators.map(curator => `<option value="${curator}" ${curator === currentCurator ? 'selected' : ''}>${curator}</option>`).join('');
}

async function createProject(event) {
  if (event) {
    event.preventDefault();
  }
  
  const form = document.getElementById('createProjectForm');
  const formData = new FormData(form);
  const status = document.getElementById('create-status');
  const createBtn = document.getElementById('createBtn');
  
  // Show loading state
  createBtn.disabled = true;
  createBtn.innerHTML = '<span class="btn-icon">⏳</span> Creating...';
  status.className = 'form-status info';
  status.textContent = 'Creating project...';
  
  try {
    // Get form values
    const title = document.getElementById('new_title').value.trim();
    const description = document.getElementById('new_desc').value.trim();
    const year = document.getElementById('new_year').value.trim();
    const curator = document.getElementById('new_curator').value;
    const tags = document.getElementById('new_tags').value.trim();
    const projectLink = document.getElementById('new_project_link').value.trim();
    const videoUrl = document.getElementById('new_video_url').value.trim();
    const feedback = document.getElementById('new_feedback').value.trim();
    
    // Get rating
    const activeStars = document.querySelectorAll('#new_rating .star.active');
    const rating = activeStars.length;
    
    // Get selected categories
    const selectedCategories = Array.from(document.querySelectorAll('.category-checkbox:checked')).map(cb => cb.value);
    
    // Validate required fields
    if (!title) {
      throw new Error('Project title is required');
    }
    
    // Prepare project data
    const projectData = {
      title,
      description: description || null,
      year: year ? parseInt(year) : null,
      curator: curator || null,
      tags: tags || null,
      project_link: projectLink || null,
      video_url: videoUrl || null,
      feedback: feedback || null,
      rating: rating,
      categories: selectedCategories
    };
    
    console.log('Creating project with data:', projectData);
    
    // Create project
    const newProject = await apiCall('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projectData)
    });
    
    console.log('Project created:', newProject);
    
    // Handle file uploads if any
    const imageFile = document.getElementById('new_image').files[0];
    const videoFile = document.getElementById('new_video').files[0];
    
    if (imageFile && newProject.id) {
      try {
        status.textContent = 'Uploading cover image...';
        
        // For Supabase mode, upload image directly and add to array
        if ((config.MODE === 'supabase' || config.MODE === 'local-json')) {
          const imageUrl = await window.supabaseAPI.uploadAndAddImage(imageFile, newProject.id);
          console.log('Cover image uploaded and added to project:', imageUrl);
        } else {
          // For API mode, use the traditional upload endpoint
          const imageFormData = new FormData();
          imageFormData.append('file', imageFile);
          
          await apiCall(`/api/projects/${newProject.id}/upload/image`, {
            method: 'POST',
            body: imageFormData
          });
          console.log('Image uploaded successfully');
        }
      } catch (uploadError) {
        console.error('Image upload failed:', uploadError);
        // Don't fail the whole operation for upload issues
      }
    }
    
    // Handle video file upload
    if (videoFile && newProject.id) {
      try {
        status.textContent = 'Uploading video...';
        
        // For Supabase mode, upload video directly and add to array
        if ((config.MODE === 'supabase' || config.MODE === 'local-json')) {
          const videoUrl = await window.supabaseAPI.uploadAndAddVideo(videoFile, newProject.id);
          console.log('Video uploaded and added to project:', videoUrl);
        } else {
          // For API mode, use the traditional upload endpoint
          const videoFormData = new FormData();
          videoFormData.append('file', videoFile);
          
          await apiCall(`/api/projects/${newProject.id}/upload/video`, {
            method: 'POST',
            body: videoFormData
          });
          console.log('Video uploaded successfully');
        }
      } catch (uploadError) {
        console.error('Video upload failed:', uploadError);
        // Don't fail the whole operation for upload issues
        status.textContent = `Project created, but video upload failed: ${uploadError.message}`;
      }
    }
    
    // Success!
    status.className = 'form-status success';
    status.textContent = '✅ Project created successfully!';
    
    // Reset form
    form.reset();
    clearRating();
    
    // Clear category checkboxes
    document.querySelectorAll('.category-checkbox').forEach(cb => cb.checked = false);
    
    // Refresh projects list
    await fetchProjects();
    
    // Close modal after a short delay
    setTimeout(() => {
      closeCreateModal();
    }, 1500);
    
  } catch (error) {
    console.error('Error creating project:', error);
    status.className = 'form-status error';
    status.textContent = `❌ Error: ${error.message}`;
  } finally {
    // Reset button
    createBtn.disabled = false;
    createBtn.innerHTML = '<span class="btn-icon">✨</span> Create Project';
  }
}

function clearRating() {
  const stars = document.querySelectorAll('#new_rating .star');
  stars.forEach(star => star.classList.remove('active'));
  document.getElementById('rating-display').textContent = '0 stars';
}

async function deleteProject(id) {
  if (!confirm('Are you sure you want to delete this project?')) return;
  
  try {
    await apiCall(`/api/projects/${id}`, { method: 'DELETE' });
    await fetchProjects();
    alert('Project deleted successfully!');
  } catch (error) {
    console.error('Error deleting project:', error);
    alert('Error deleting project. Please try again.');
  }
}

function openCreateModal() {
  const modal = document.getElementById('createProjectModal');
  modal.style.display = 'flex';
  
  // Clear form
  document.getElementById('createProjectForm').reset();
  clearFormStatus();
  
  // Reset rating display
  document.getElementById('rating-display').textContent = '0 stars';
  const stars = document.querySelectorAll('#new_rating .star');
  stars.forEach(star => star.classList.remove('active'));
}

function closeCreateModal() {
  const modal = document.getElementById('createProjectModal');
  modal.style.display = 'none';
}

function clearFormStatus() {
  const status = document.getElementById('create-status');
  status.className = 'form-status';
  status.textContent = '';
}

function toggleFilters() {
  const filters = document.getElementById('controlsFilters');
  const isOpen = filters.classList.contains('open');
  
  if (isOpen) {
    filters.classList.remove('open');
  } else {
    filters.style.display = 'flex';
    // Small delay to ensure display change takes effect before adding 'open' class
    setTimeout(() => {
      filters.classList.add('open');
    }, 10);
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
  // Update config reference in case it loaded after this script
  config = window.CONFIG || { MODE: 'demo', DEMO_MODE: true };
  
  console.log('DOM loaded, mode:', config.MODE || 'demo');
  console.log('Environment loaded:', !!window.ENV);
  console.log('Supabase loaded:', !!window.supabase);
  
  // Initialize keyboard navigation
  setupKeyboardNavigation();
  
  // Initialize
  console.log('Initializing application...');
  fetchProjects();
  
  // Show demo mode indicator
  if (config.DEMO_MODE) {
    const header = document.querySelector('h1');
    header.innerHTML += '<div style="font-size: 14px; color: rgba(255,255,255,0.8); font-weight: normal;"></div>';
  }
  
  // Event listeners
  document.getElementById('createToggle').addEventListener('click', openCreateModal);
  document.getElementById('filterToggle').addEventListener('click', toggleFilters);
  document.getElementById('createProjectForm').addEventListener('submit', createProject);
  
  // Rating system
  setupRatingSystem();
  
  // File upload handlers
  setupFileUploads();
  
  // Modal close on overlay click
  document.getElementById('createProjectModal').addEventListener('click', function(e) {
    if (e.target === this) {
      closeCreateModal();
    }
  });
  // Filter event listeners
  document.getElementById('applyFilters').addEventListener('click', fetchProjects);
  document.getElementById('clearFilters').addEventListener('click', clearAllFilters);
  
  // Real-time filtering on input changes
  document.getElementById('search').addEventListener('input', debounce(fetchProjects, 300));
  document.getElementById('year').addEventListener('change', fetchProjects);
  document.getElementById('curator').addEventListener('change', fetchProjects);
  document.getElementById('category').addEventListener('change', fetchProjects);
  document.getElementById('rating').addEventListener('change', fetchProjects);
  document.getElementById('sortBy').addEventListener('change', fetchProjects);
  
  // Quick filter toggles
  document.getElementById('filterHasMedia').addEventListener('click', function() {
    this.classList.toggle('active');
    fetchProjects();
  });
  document.getElementById('filterNoMedia').addEventListener('click', function() {
    this.classList.toggle('active');
    fetchProjects();
  });
  document.getElementById('filterHasVideo').addEventListener('click', function() {
    this.classList.toggle('active');
    fetchProjects();
  });
  document.getElementById('filterNoVideo').addEventListener('click', function() {
    this.classList.toggle('active');
    fetchProjects();
  });
  document.getElementById('filterHasLinks').addEventListener('click', function() {
    this.classList.toggle('active');
    fetchProjects();
  });
  document.getElementById('filterHasComments').addEventListener('click', function() {
    this.classList.toggle('active');
    fetchProjects();
  });
  
  
  document.getElementById('randomProjects').addEventListener('click', function() {
    state.randomMode = !state.randomMode;
    this.textContent = state.randomMode ? '📋 Show all projects' : '🎲 Show me 4 random projects';
    this.classList.toggle('showing-all', state.randomMode);
    
    if (state.randomMode) {
      showRandomProjects();
    } else {
      fetchProjects();
    }
  });
  
  // View mode toggle
  document.getElementById('viewModeToggle').addEventListener('click', function() {
    state.commentsViewMode = !state.commentsViewMode;
    
    if (state.commentsViewMode) {
      this.querySelector('.icon').textContent = '🏠';
      this.querySelector('.text').textContent = 'Gallery View';
      this.classList.add('active');
    } else {
      this.querySelector('.icon').textContent = '💬';
      this.querySelector('.text').textContent = 'Comments View';
      this.classList.remove('active');
    }
    
    // Refresh display
    fetchProjects();
  });
  
  // Search on enter
  document.getElementById('search').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      fetchProjects();
    }
  });
  
  // Hide filters initially
  document.getElementById('controlsFilters').style.display = 'none';
  
  // Disable admin features in demo mode
  if (config.DEMO_MODE) {
    const adminToggle = document.getElementById('adminToggle');
    if (adminToggle) {
      adminToggle.style.opacity = '0.5';
      adminToggle.disabled = true;
      adminToggle.title = 'Admin features disabled in demo mode';
    }
  }
});

// Rating system setup
function setupRatingSystem() {
  const stars = document.querySelectorAll('#new_rating .star');
  const ratingDisplay = document.getElementById('rating-display');
  
  stars.forEach((star, index) => {
    star.addEventListener('click', () => {
      const rating = index + 1;
      
      // Clear all stars
      stars.forEach(s => s.classList.remove('active'));
      
      // Activate stars up to clicked one
      for (let i = 0; i <= index; i++) {
        stars[i].classList.add('active');
      }
      
      // Update display
      ratingDisplay.textContent = `${rating} star${rating !== 1 ? 's' : ''}`;
    });
    
    // Hover effects
    star.addEventListener('mouseenter', () => {
      stars.forEach((s, i) => {
        if (i <= index) {
          s.style.color = '#fbbf24';
        } else {
          s.style.color = '#d1d5db';
        }
      });
    });
  });
  
  // Reset hover effect on mouse leave
  const ratingContainer = document.getElementById('new_rating');
  ratingContainer.addEventListener('mouseleave', () => {
    stars.forEach((star, i) => {
      if (star.classList.contains('active')) {
        star.style.color = '#fbbf24';
      } else {
        star.style.color = '#d1d5db';
      }
    });
  });
}

// File upload setup
function setupFileUploads() {
  const imageInput = document.getElementById('new_image');
  const videoInput = document.getElementById('new_video');
  const imageInfo = document.getElementById('image-info');
  const videoInfo = document.getElementById('video-info');
  const imageArea = imageInput.parentElement;
  const videoArea = videoInput.parentElement;
  
  // Image upload
  imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const size = (file.size / 1024 / 1024).toFixed(2);
      imageInfo.textContent = `${file.name} (${size} MB)`;
      imageArea.style.borderColor = '#4ba254';
      imageArea.style.background = '#f0fdf4';
    } else {
      imageInfo.textContent = '';
      imageArea.style.borderColor = '#d1d5db';
      imageArea.style.background = '#fafafa';
    }
  });
  
  // Video upload
  videoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const size = (file.size / 1024 / 1024).toFixed(2);
      videoInfo.textContent = `${file.name} (${size} MB)`;
      videoArea.style.borderColor = '#4ba254';
      videoArea.style.background = '#f0fdf4';
    } else {
      videoInfo.textContent = '';
      videoArea.style.borderColor = '#d1d5db';
      videoArea.style.background = '#fafafa';
    }
  });
  
  // Drag and drop for image
  setupDragAndDrop(imageArea, imageInput, imageInfo);
  setupDragAndDrop(videoArea, videoInput, videoInfo);
}

function setupDragAndDrop(area, input, info) {
  area.addEventListener('dragover', (e) => {
    e.preventDefault();
    area.classList.add('drag-over');
  });
  
  area.addEventListener('dragleave', () => {
    area.classList.remove('drag-over');
  });
  
  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      input.files = files;
      input.dispatchEvent(new Event('change'));
    }
  });
}

// Project Modal Functions
let currentProject = null;
let isEditMode = false;
let currentProjectIndex = -1;
let currentProjectList = [];

async function openProjectModal(projectId) {
  console.log('Opening project modal for ID:', projectId);
  
  try {
    // Clear any previous comments FIRST
    const commentsList = document.getElementById('commentsList');
    if (commentsList) {
      commentsList.innerHTML = '<div class="comments-loading">Loading comments...</div>';
    }
    
    // Fetch project details
    currentProject = await window.supabaseAPI.getProject(projectId);
    if (!currentProject) {
      alert('Project not found');
      return;
    }
    
    console.log('Loaded project:', currentProject);
    
    // Set up navigation context
    setupProjectNavigation(projectId);
    
    // Populate view mode
    populateProjectView(currentProject);
    
    // Show modal
    document.getElementById('projectDetailModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
  // Setup comments event listener (only once)
  const commentForm = document.getElementById('addCommentForm');
  if (commentForm && !commentForm.hasAttribute('data-listener-added')) {
    commentForm.addEventListener('submit', addComment);
    commentForm.setAttribute('data-listener-added', 'true');
  }
  
  // Setup category description updater
  setupCategoryDescription();
    
    // Make sure we're in view mode
    isEditMode = false;
    document.getElementById('viewMode').style.display = 'block';
    document.getElementById('editMode').style.display = 'none';
    document.getElementById('editProjectBtn').textContent = 'Edit';
    
  } catch (error) {
    console.error('Error loading project:', error);
    alert('Failed to load project details');
  }
}

// Helper function to convert video URL to embed code
function getVideoEmbedHtml(url, maxHeight = '350px') {
  // YouTube patterns
  const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/;
  const youtubeMatch = url.match(youtubeRegex);
  
  if (youtubeMatch) {
    const videoId = youtubeMatch[1];
    return `<iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="width: 100%; max-height: ${maxHeight}; height: 400px; border: 1px solid #e5e7eb;"></iframe>`;
  }
  
  // Vimeo patterns
  const vimeoRegex = /vimeo\.com\/(?:video\/)?(\d+)/;
  const vimeoMatch = url.match(vimeoRegex);
  
  if (vimeoMatch) {
    const videoId = vimeoMatch[1];
    return `<iframe src="https://player.vimeo.com/video/${videoId}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen style="width: 100%; max-height: ${maxHeight}; height: 400px; border: 1px solid #e5e7eb;"></iframe>`;
  }
  
  // If not YouTube or Vimeo, show link
  return `
    <div style="text-align: center; padding: 2rem;">
      <div style="font-size: 3rem; margin-bottom: 1rem;">🎥</div>
      <a href="${escapeHtml(url)}" target="_blank" class="btn btn-primary">Watch Video</a>
    </div>`;
}

function populateProjectView(project) {
  // Update modal title
  document.getElementById('modalTitle').textContent = project.title;
  
  // Populate media container
  const mediaContainer = document.getElementById('projectMediaContainer');
  let mediaHtml = '';
  
  // Display all images from image_urls array
  if (project.image_urls && project.image_urls.length > 0) {
    mediaHtml += '<div class="media-grid">';
    project.image_urls.forEach((imageUrl, index) => {
      mediaHtml += `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(project.title)} - Image ${index + 1}" onclick="showLightbox('${escapeHtml(imageUrl)}')" style="cursor: pointer;" />`;
    });
    mediaHtml += '</div>';
  }
  
  // Display all videos from video_urls array
  if (project.video_urls && project.video_urls.length > 0) {
    // If multiple videos, show in grid; if single, show full width
    if (project.video_urls.length > 1) {
      mediaHtml += '<div class="media-grid">';
      project.video_urls.forEach((videoUrl, index) => {
        if (videoUrl.includes('/storage/v1/object/public/')) {
          // Uploaded video file
          mediaHtml += `<video src="${escapeHtml(videoUrl)}" controls preload="metadata" style="width: 100%; max-height: 300px; object-fit: contain;"></video>`;
        } else {
          // External video (YouTube/Vimeo)
          mediaHtml += getVideoEmbedHtml(videoUrl, '300px');
        }
      });
      mediaHtml += '</div>';
    } else {
      // Single video - show full width
      project.video_urls.forEach((videoUrl, index) => {
        if (videoUrl.includes('/storage/v1/object/public/')) {
          // Uploaded video file
          mediaHtml += `<video src="${escapeHtml(videoUrl)}" controls preload="metadata" style="width: 100%; max-height: 350px; object-fit: contain; margin-bottom: 0.5rem;"></video>`;
        } else {
          // External video (YouTube/Vimeo)
          mediaHtml += getVideoEmbedHtml(videoUrl, '350px');
        }
      });
    }
  }
  
  // Display external video URL if present
  if (project.video_url) {
    if (project.video_url.includes('/storage/v1/object/public/')) {
      // Uploaded video
      mediaHtml += `<video src="${escapeHtml(project.video_url)}" controls preload="metadata" style="width: 100%;"></video>`;
    } else {
      // External video URL (YouTube/Vimeo embed)
      mediaHtml += getVideoEmbedHtml(project.video_url, '400px');
    }
  }
  
  // If no media at all
  if (!mediaHtml) {
    mediaHtml = `
      <div style="text-align: center; color: #64748b;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">📁</div>
        <p>No media available</p>
      </div>`;
  }
  
  mediaContainer.innerHTML = mediaHtml;
  
  // Populate basic info
  document.getElementById('modalYear').textContent = project.year || 'Not specified';
  document.getElementById('modalCurator').textContent = project.curator || 'Not specified';
  
  // Populate rating
  const ratingElement = document.getElementById('modalRating');
  ratingElement.setAttribute('data-project-id', project.id);
  
  // Clear all stars first
  const stars = ratingElement.querySelectorAll('.star');
  stars.forEach(star => star.classList.remove('active'));
  
  // Set active stars based on current rating
  if (project.rating && project.rating > 0) {
    for (let i = 0; i < project.rating; i++) {
      stars[i].classList.add('active');
    }
  }
  
  // Setup click handlers for rating stars
  setupModalRatingHandlers();
  
  // Load comments for this project
  loadComments(project.id);
  
  // Populate description
  const descSection = document.getElementById('descriptionSection');
  if (project.description) {
    // Convert line breaks to <br> tags for display
    const descriptionWithBreaks = project.description.replace(/\n/g, '<br>');
    document.getElementById('modalDescription').innerHTML = descriptionWithBreaks;
    descSection.style.display = 'block';
  } else {
    descSection.style.display = 'none';
  }
  
  // Populate tags
  const tagsSection = document.getElementById('tagsSection');
  const tagsContainer = document.getElementById('modalTags');
  if (project.tags) {
    const tags = project.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    tagsContainer.innerHTML = tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
    tagsSection.style.display = 'block';
  } else {
    tagsSection.style.display = 'none';
  }
  
  // Populate categories
  const categoriesSection = document.getElementById('categoriesSection');
  const categoriesContainer = document.getElementById('modalCategories');
  if (project.categories && project.categories.length > 0) {
    categoriesContainer.innerHTML = project.categories.map(cat => 
      `<span class="category-badge category-${getCategorySlug(cat)}" onclick="filterByCategory('${escapeHtml(cat)}'); closeProjectModal();" style="cursor: pointer;" title="Click to filter by ${escapeHtml(cat)}">${escapeHtml(cat)}</span>`
    ).join('');
    if (categoriesSection) categoriesSection.style.display = 'block';
  } else {
    if (categoriesSection) categoriesSection.style.display = 'none';
  }
  
  // Populate links
  const hasLinks = project.project_link || project.github_repo || project.documentation || project.video_url;
  const linksSection = document.getElementById('linksSection');
  
  if (hasLinks) {
    linksSection.style.display = 'block';
    
    // Project link
    const projectLinkItem = document.getElementById('projectLinkItem');
    if (project.project_link) {
      document.getElementById('modalProjectLink').href = project.project_link;
      projectLinkItem.style.display = 'block';
    } else {
      projectLinkItem.style.display = 'none';
    }
    
    // GitHub link
    const githubLinkItem = document.getElementById('githubLinkItem');
    if (project.github_repo) {
      document.getElementById('modalGithubRepo').href = project.github_repo;
      githubLinkItem.style.display = 'block';
    } else {
      githubLinkItem.style.display = 'none';
    }
    
    // Documentation link
    const docLinkItem = document.getElementById('documentationLinkItem');
    if (project.documentation) {
      document.getElementById('modalDocumentation').href = project.documentation;
      docLinkItem.style.display = 'block';
    } else {
      docLinkItem.style.display = 'none';
    }
    
    // Video link (only show if it's external, not uploaded)
    const videoLinkItem = document.getElementById('videoLinkItem');
    if (project.video_url && !project.video_url.includes('/storage/v1/object/public/')) {
      document.getElementById('modalVideoUrl').href = project.video_url;
      videoLinkItem.style.display = 'block';
    } else {
      videoLinkItem.style.display = 'none';
    }
  } else {
    linksSection.style.display = 'none';
  }
  
  // Populate feedback
  const feedbackSection = document.getElementById('feedbackSection');
  if (project.feedback) {
    document.getElementById('modalFeedback').textContent = project.feedback;
    feedbackSection.style.display = 'block';
  } else {
    feedbackSection.style.display = 'none';
  }
}

function closeProjectModal() {
  document.getElementById('projectDetailModal').style.display = 'none';
  document.body.style.overflow = 'auto';
  currentProject = null;
  isEditMode = false;
  currentProjectIndex = -1;
  currentProjectList = [];
}

// Project Navigation Functions
function setupProjectNavigation(projectId) {
  // Get the current filtered project list from the displayed cards
  const projectCards = document.querySelectorAll('.card[data-project-id]');
  currentProjectList = Array.from(projectCards).map(card => parseInt(card.dataset.projectId));
  currentProjectIndex = currentProjectList.indexOf(parseInt(projectId));
  
  console.log('Navigation setup:', { currentProjectList, currentProjectIndex, projectId });
  
  // Update navigation button states
  updateNavigationButtons();
}

function updateNavigationButtons() {
  const prevBtn = document.getElementById('prevProjectBtn');
  const nextBtn = document.getElementById('nextProjectBtn');
  
  if (prevBtn) {
    prevBtn.disabled = currentProjectIndex <= 0;
  }
  
  if (nextBtn) {
    nextBtn.disabled = currentProjectIndex >= currentProjectList.length - 1;
  }
}

async function navigateToPreviousProject() {
  if (currentProjectIndex > 0) {
    const prevProjectId = currentProjectList[currentProjectIndex - 1];
    await openProjectModal(prevProjectId);
  }
}

async function navigateToNextProject() {
  if (currentProjectIndex < currentProjectList.length - 1) {
    const nextProjectId = currentProjectList[currentProjectIndex + 1];
    await openProjectModal(nextProjectId);
  }
}

// Keyboard navigation
function setupKeyboardNavigation() {
  document.addEventListener('keydown', function(e) {
    // Only handle keyboard navigation when modal is open
    const modal = document.getElementById('projectDetailModal');
    if (!modal || modal.style.display === 'none') {
      return;
    }
    
    // Don't handle keyboard events when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
      return;
    }
    
    switch(e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        navigateToPreviousProject();
        break;
      case 'ArrowRight':
        e.preventDefault();
        navigateToNextProject();
        break;
      case 'Escape':
        e.preventDefault();
        closeProjectModal();
        break;
    }
  });
}

async function toggleEditMode() {
  if (!currentProject) {
    console.error('No current project to edit');
    return;
  }
  
  console.log('Toggling edit mode for project:', currentProject);
  isEditMode = !isEditMode;
  
  if (isEditMode) {
    // Switch to edit mode
    try {
      await populateEditForm(currentProject);
      document.getElementById('viewMode').style.display = 'none';
      document.getElementById('editMode').style.display = 'block';
      document.getElementById('editProjectBtn').textContent = 'Cancel';
      
      // Store current project ID for video trimming
      window.currentEditingProjectId = currentProject.id;
      
      // Set up edit form rating system
      setupEditRatingSystem();
    } catch (error) {
      console.error('Error switching to edit mode:', error);
      // Revert the mode change
      isEditMode = false;
    }
  } else {
    // Switch back to view mode
    document.getElementById('viewMode').style.display = 'block';
    document.getElementById('editMode').style.display = 'none';
    document.getElementById('editProjectBtn').textContent = 'Edit';
    
    // Clear project ID
    window.currentEditingProjectId = null;
  }
}

async function populateEditForm(project) {
  try {
    // Populate all form fields
    document.getElementById('edit_title').value = project.title || '';
    document.getElementById('edit_year').value = project.year || '';
    document.getElementById('edit_curator').value = project.curator || '';
    document.getElementById('edit_description').value = project.description || '';
    document.getElementById('edit_tags').value = project.tags || '';
    document.getElementById('edit_project_link').value = project.project_link || '';
    document.getElementById('edit_video_url').value = project.video_url || '';
    document.getElementById('edit_feedback').value = project.feedback || '';
    
    // Set rating
    const rating = project.rating || 0;
    const editStars = document.querySelectorAll('#edit_rating .star');
    editStars.forEach((star, index) => {
      if (index < rating) {
        star.classList.add('active');
      } else {
        star.classList.remove('active');
      }
    });
    
    // Set categories
    const categories = project.categories || [];
    document.querySelectorAll('.edit-category-checkbox').forEach(cb => {
      cb.checked = categories.includes(cb.value);
    });
    
    // Show current media
    populateCurrentMedia(project);
    
    // Clear any previously selected new files
    document.getElementById('edit_new_image').value = '';
    document.getElementById('edit_new_video').value = '';
    document.getElementById('edit-image-info').textContent = '';
    document.getElementById('edit-video-info').textContent = '';
    
    // Set up media upload areas
    setupEditMediaUploads();
  } catch (error) {
    console.error('Error in populateEditForm:', error);
    // Still try to populate basic fields even if media fails
    document.getElementById('edit_title').value = project.title || '';
    document.getElementById('edit_year').value = project.year || '';
    document.getElementById('edit_curator').value = project.curator || '';
    document.getElementById('edit_description').value = project.description || '';
    document.getElementById('edit_tags').value = project.tags || '';
    document.getElementById('edit_project_link').value = project.project_link || '';
    document.getElementById('edit_video_url').value = project.video_url || '';
    document.getElementById('edit_feedback').value = project.feedback || '';
  }
}

function populateCurrentMedia(project) {
  const currentMediaSection = document.getElementById('currentMediaSection');
  
  if (!currentMediaSection) {
    console.warn('Current media section not found');
    return;
  }
  
  let mediaHtml = '';
  
  // Show all current images
  if (project.image_urls && project.image_urls.length > 0) {
    mediaHtml += '<div class="current-media-group"><h4>Current Images (' + project.image_urls.length + ')</h4><div class="current-media-grid">';
    project.image_urls.forEach((imageUrl, index) => {
      mediaHtml += `
        <div class="current-media-item">
          <img src="${escapeHtml(imageUrl)}" alt="Image ${index + 1}" style="max-width: 150px; max-height: 100px; object-fit: cover; border: 1px solid #e5e7eb;" />
          <button type="button" class="media-remove-btn" onclick="removeImageFromProject('${escapeHtml(imageUrl)}')" title="Remove">×</button>
        </div>`;
    });
    mediaHtml += '</div></div>';
  }
  
  // Show all current videos
  if (project.video_urls && project.video_urls.length > 0) {
    mediaHtml += '<div class="current-media-group"><h4>Current Videos (' + project.video_urls.length + ')</h4><div class="current-media-grid">';
    project.video_urls.forEach((videoUrl, index) => {
      mediaHtml += `
        <div class="current-media-item">
          <video src="${escapeHtml(videoUrl)}" controls style="max-width: 150px; max-height: 100px; border: 1px solid #e5e7eb;"></video>
          <button type="button" class="media-remove-btn" onclick="removeVideoFromProject('${escapeHtml(videoUrl)}')" title="Remove">×</button>
        </div>`;
    });
    mediaHtml += '</div></div>';
  }
  
  if (!mediaHtml) {
    mediaHtml = '<div class="no-media-message">No media files yet. Upload images or videos below.</div>';
  }
  
  currentMediaSection.innerHTML = mediaHtml;
}

function setupEditMediaUploads() {
  const imageInput = document.getElementById('edit_new_image');
  const videoInput = document.getElementById('edit_new_video');
  const imageInfo = document.getElementById('edit-image-info');
  const videoInfo = document.getElementById('edit-video-info');
  const imageArea = imageInput.parentElement;
  const videoArea = videoInput.parentElement;
  
  // Image upload handling - supports multiple files
  imageInput.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // Validate all files are images
      const allImages = Array.from(files).every(file => file.type.startsWith('image/'));
      if (!allImages) {
        alert('Please select only image files');
        imageInput.value = '';
        return;
      }
      
      // Show file count and total size
      const totalSize = Array.from(files).reduce((sum, file) => sum + file.size, 0);
      const sizeMB = (totalSize / 1024 / 1024).toFixed(2);
      
      if (files.length === 1) {
        imageInfo.textContent = `${files[0].name} (${sizeMB} MB)`;
      } else {
        imageInfo.textContent = `${files.length} images selected (${sizeMB} MB total)`;
      }
      
      imageArea.style.borderColor = '#1e293b';
      imageArea.style.background = '#f5f5f5';
    } else {
      imageInfo.textContent = '';
      imageArea.style.borderColor = '#cbd5e1';
      imageArea.style.background = '#fafafa';
    }
  });
  
  // Video upload handling
  videoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        alert('Please select a video file');
        videoInput.value = '';
        return;
      }
      const size = (file.size / 1024 / 1024).toFixed(2);
      videoInfo.textContent = `${file.name} (${size} MB)`;
      videoArea.style.borderColor = '#4ba254';
      videoArea.style.background = '#f0fdf4';
    } else {
      videoInfo.textContent = '';
      videoArea.style.borderColor = '#cbd5e1';
      videoArea.style.background = '#fafafa';
    }
  });
  
  // Drag and drop for image
  setupEditDragAndDrop(imageArea, imageInput, imageInfo);
  setupEditDragAndDrop(videoArea, videoInput, videoInfo);
}

function setupEditDragAndDrop(area, input, info) {
  area.addEventListener('dragover', (e) => {
    e.preventDefault();
    area.classList.add('drag-over');
  });
  
  area.addEventListener('dragleave', () => {
    area.classList.remove('drag-over');
  });
  
  area.addEventListener('drop', (e) => {
    e.preventDefault();
    area.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      input.files = files;
      input.dispatchEvent(new Event('change'));
    }
  });
}

function setupEditRatingSystem() {
  const editStars = document.querySelectorAll('#edit_rating .star');
  editStars.forEach((star, index) => {
    star.addEventListener('click', () => {
      editStars.forEach((s, i) => {
        if (i <= index) {
          s.classList.add('active');
        } else {
          s.classList.remove('active');
        }
      });
    });
  });
}

function cancelEdit() {
  isEditMode = false;
  document.getElementById('viewMode').style.display = 'block';
  document.getElementById('editMode').style.display = 'none';
  document.getElementById('editProjectBtn').textContent = 'Edit';
}

// Media deletion functions
async function deleteCurrentImage() {
  if (!currentProject || !currentProject.image_url) return;
  
  if (!confirm('Are you sure you want to delete the current image?')) return;
  
  try {
    if ((config.MODE === 'supabase' || config.MODE === 'local-json')) {
      await window.supabaseAPI.deleteProjectImage(currentProject.id);
    } else {
      await apiCall(`/api/projects/${currentProject.id}/image`, { method: 'DELETE' });
    }
    
    // Update current project data
    currentProject.image_url = null;
    
    // Hide the image section
    document.getElementById('currentImageSection').style.display = 'none';
    
    // Update the view mode media display
    populateProjectView(currentProject);
    
    console.log('Image deleted successfully');
  } catch (error) {
    console.error('Error deleting image:', error);
    alert(`Failed to delete image: ${error.message}`);
  }
}

async function deleteCurrentVideo() {
  if (!currentProject || !currentProject.video_url || !currentProject.video_url.includes('/storage/v1/object/public/')) return;
  
  if (!confirm('Are you sure you want to delete the current video?')) return;
  
  try {
    if ((config.MODE === 'supabase' || config.MODE === 'local-json')) {
      await window.supabaseAPI.deleteProjectVideo(currentProject.id);
    } else {
      await apiCall(`/api/projects/${currentProject.id}/video`, { method: 'DELETE' });
    }
    
    // Update current project data
    currentProject.video_url = null;
    
    // Hide the video section
    document.getElementById('currentVideoSection').style.display = 'none';
    
    // Update the view mode media display
    populateProjectView(currentProject);
    
    console.log('Video deleted successfully');
  } catch (error) {
    console.error('Error deleting video:', error);
    alert(`Failed to delete video: ${error.message}`);
  }
}

// Add event listener for edit form submission
document.addEventListener('DOMContentLoaded', function() {
  // Existing DOMContentLoaded code...
  
  // Add edit form submission handler
  const editForm = document.getElementById('editProjectForm');
  if (editForm) {
    editForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      await saveProjectChanges();
    });
  }
  
  // Add modal close on overlay click
  const projectModal = document.getElementById('projectDetailModal');
  if (projectModal) {
    projectModal.addEventListener('click', function(e) {
      if (e.target === this) {
        closeProjectModal();
      }
    });
  }
});

async function saveProjectChanges() {
  if (!currentProject) return;
  
  const saveBtn = document.getElementById('saveBtn');
  const status = document.getElementById('edit-status');
  
  // Show loading state
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="btn-icon">⏳</span> Saving...';
  status.className = 'form-status info';
  status.textContent = 'Saving changes...';
  
  try {
    // Collect form data
    const title = document.getElementById('edit_title').value.trim();
    const year = document.getElementById('edit_year').value.trim();
    const curator = document.getElementById('edit_curator').value;
    const description = document.getElementById('edit_description').value.trim();
    const tags = document.getElementById('edit_tags').value.trim();
    const projectLink = document.getElementById('edit_project_link').value.trim();
    const videoUrl = document.getElementById('edit_video_url').value.trim();
    const feedback = document.getElementById('edit_feedback').value.trim();
    
    // Get rating
    const activeStars = document.querySelectorAll('#edit_rating .star.active');
    const rating = activeStars.length;
    
    // Get selected categories
    const selectedCategories = Array.from(document.querySelectorAll('.edit-category-checkbox:checked')).map(cb => cb.value);
    
    // Validate required fields
    if (!title) {
      throw new Error('Project title is required');
    }
    
    // Prepare updated project data
    const updatedProject = {
      title,
      description: description || null,
      year: year ? parseInt(year) : null,
      curator: curator || null,
      rating: rating || 0,
      tags: tags || null,
      project_link: projectLink || null,
      feedback: feedback || null,
      categories: selectedCategories
    };
    
    // Only include video_url if it's provided
    if (videoUrl) {
      updatedProject.video_url = videoUrl;
    }
    
    console.log('Updating project with data:', updatedProject);
    
    // Update project via API
    if ((config.MODE === 'supabase' || config.MODE === 'local-json')) {
      await window.supabaseAPI.updateProject(currentProject.id, updatedProject);
    } else {
      await apiCall(`/api/projects/${currentProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProject)
      });
    }
    
    // Update current project data
    Object.assign(currentProject, updatedProject);
    
    // Handle new media uploads (add to existing media instead of replacing)
    const newImageFiles = document.getElementById('edit_new_image').files;
    const newVideoFile = document.getElementById('edit_new_video').files[0];
    
    if (newImageFiles && newImageFiles.length > 0) {
      try {
        const fileCount = newImageFiles.length;
        status.textContent = `Uploading ${fileCount} image${fileCount > 1 ? 's' : ''}...`;
        
        if ((config.MODE === 'supabase' || config.MODE === 'local-json')) {
          // Upload all images to the array
          if (!currentProject.image_urls) {
            currentProject.image_urls = [];
          }
          
          for (let i = 0; i < newImageFiles.length; i++) {
            const file = newImageFiles[i];
            status.textContent = `Uploading image ${i + 1} of ${fileCount}...`;
            const imageUrl = await window.supabaseAPI.uploadAndAddImage(file, currentProject.id);
            currentProject.image_urls.push(imageUrl);
            console.log(`Image ${i + 1}/${fileCount} uploaded:`, imageUrl);
          }
          
          console.log(`All ${fileCount} images uploaded successfully`);
        } else {
          // API mode upload - upload each file
          for (let i = 0; i < newImageFiles.length; i++) {
            const imageFormData = new FormData();
            imageFormData.append('file', newImageFiles[i]);
            await apiCall(`/api/projects/${currentProject.id}/upload/image`, {
              method: 'POST',
              body: imageFormData
            });
          }
        }
      } catch (uploadError) {
        console.error('Image upload failed:', uploadError);
        status.textContent = `Project updated, but image upload failed: ${uploadError.message}`;
      }
    }
    
    if (newVideoFile) {
      try {
        status.textContent = 'Uploading new video...';
        
        if ((config.MODE === 'supabase' || config.MODE === 'local-json')) {
          // Add new video to the array (don't delete old ones)
          const videoUrl = await window.supabaseAPI.uploadAndAddVideo(newVideoFile, currentProject.id);
          
          // Update local project data
          if (!currentProject.video_urls) {
            currentProject.video_urls = [];
          }
          currentProject.video_urls.push(videoUrl);
          
          console.log('New video uploaded and added:', videoUrl);
        } else {
          // API mode upload
          const videoFormData = new FormData();
          videoFormData.append('file', newVideoFile);
          
          await apiCall(`/api/projects/${currentProject.id}/upload/video`, {
            method: 'POST',
            body: videoFormData
          });
        }
      } catch (uploadError) {
        console.error('Video upload failed:', uploadError);
        status.textContent = `Project updated, but video upload failed: ${uploadError.message}`;
      }
    }
    
    // Update the view with new data
    populateProjectView(currentProject);
    
    // Switch back to view mode
    isEditMode = false;
    document.getElementById('viewMode').style.display = 'block';
    document.getElementById('editMode').style.display = 'none';
    document.getElementById('editProjectBtn').textContent = 'Edit';
    
    // Show success message
    status.className = 'form-status success';
    status.textContent = '✅ Project updated successfully!';
    
    // Refresh the main gallery to show updated project
    if (typeof fetchProjects === 'function') {
      fetchProjects();
    }
    
    console.log('Project updated successfully');
    
  } catch (error) {
    console.error('Error updating project:', error);
    status.className = 'form-status error';
    status.textContent = `❌ Error: ${error.message}`;
  } finally {
    // Reset button state
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<span class="btn-icon">💾</span> Save Changes';
    
    // Clear status after 5 seconds
    setTimeout(() => {
      status.textContent = '';
      status.className = 'form-status';
    }, 5000);
  }
}

// Comments functionality
async function loadComments(projectId) {
  const commentsList = document.getElementById('commentsList');
  const commentsLoading = document.getElementById('commentsLoading');
  
  // Check if required elements exist
  if (!commentsList) {
    console.error('Comments list element not found');
    return;
  }
  
  // commentsLoading is optional - we can work without it
  
  try {
    // Clear comments list completely first
    commentsList.innerHTML = '';
    
    if (commentsLoading) {
      commentsLoading.style.display = 'flex';
      commentsList.appendChild(commentsLoading);
    }
    
    console.log('🔍 Loading comments for project ID:', projectId);
    const comments = await window.supabaseAPI.getComments(projectId);
    console.log('📝 Received', comments.length, 'comments for project', projectId);
    
    if (commentsLoading) {
      commentsLoading.style.display = 'none';
    }
    
    // Clear again before rendering to ensure no old data
    commentsList.innerHTML = '';
    
    if (!comments || comments.length === 0) {
      commentsList.innerHTML = '<div class="comments-empty">Please leave your thoughts and feedback on this project and how it can be integrated (or not) at NEMO</div>';
      return;
    }
    
    // Render only comments that match this project
    const projectComments = comments.filter(c => c.project_id === parseInt(projectId));
    console.log('✓ Filtered to', projectComments.length, 'comments for this specific project');
    
    if (projectComments.length === 0) {
      commentsList.innerHTML = '<div class="comments-empty">Please leave your thoughts and feedback on this project and how it can be integrated (or not) at NEMO</div>';
      commentsList.setAttribute('data-project-id', projectId);
      return;
    }
    
    // Set the project ID on the comments list to track which project's comments are shown
    commentsList.setAttribute('data-project-id', projectId);
    commentsList.innerHTML = projectComments.map(comment => createCommentHTML(comment)).join('');
    
    // Add delete event listeners
    commentsList.querySelectorAll('.comment-delete-icon').forEach(button => {
      button.addEventListener('click', function() {
        const commentId = this.dataset.commentId;
        deleteComment(commentId);
      });
    });
    
  } catch (error) {
    console.error('❌ Error loading comments:', error);
    if (commentsLoading) {
      commentsLoading.style.display = 'none';
    }
    commentsList.innerHTML = '<div class="comments-empty">Error loading comments. Please try again.</div>';
  }
}

function createCommentHTML(comment) {
  // Map category numbers to names and CSS classes
  const categoryNames = {
    '1': 'Exhibition type',
    '2': 'Opportunities',
    '3': 'Challenges',
    '4': 'Visitor experience',
    '5': 'Open Comment'
  };
  
  const categoryClasses = {
    '1': 'category-exhibition',
    '2': 'category-opportunities',
    '3': 'category-challenges',
    '4': 'category-visitor',
    '5': 'category-open'
  };
  
  const categoryName = categoryNames[comment.category] || `Category ${comment.category}`;
  const categoryClass = categoryClasses[comment.category] || 'category-default';
  
  return `
    <div class="comment-item">
      <div class="comment-item-header">
        <div class="comment-category-badge ${categoryClass}">${categoryName}</div>
        <div class="comment-meta-right">
          <span class="comment-author-small">${escapeHtml(comment.author)}</span>
          <button class="comment-delete-icon" data-comment-id="${comment.id}" title="Delete">×</button>
        </div>
      </div>
      <div class="comment-body">
        <p class="comment-text">${escapeHtml(comment.comment_text || comment.text)}</p>
      </div>
    </div>
  `;
}

async function addComment(event) {
  event.preventDefault();
  
  console.log('addComment function called');
  
  const status = document.getElementById('comment-status');
  const submitBtn = event.target.querySelector('button[type="submit"]');
  
  console.log('Status element:', status);
  console.log('Submit button:', submitBtn);
  
  // Check if required elements exist
  if (!status) {
    console.error('Comment status element not found');
    return;
  }
  
  if (!submitBtn) {
    console.error('Submit button not found');
    status.className = 'form-status error';
    status.textContent = 'Form error: Submit button not found';
    return;
  }
  
  // Get form data
  const categoryEl = document.getElementById('commentCategory');
  const authorEl = document.getElementById('commentAuthor');
  const textEl = document.getElementById('commentText');
  
  console.log('Form elements:', { categoryEl, authorEl, textEl });
  
  if (!categoryEl || !authorEl || !textEl) {
    console.error('Form elements not found');
    status.className = 'form-status error';
    status.textContent = 'Form error: Required fields not found';
    return;
  }
  
  const category = categoryEl.value;
  const author = authorEl.value.trim();
  const text = textEl.value.trim();
  
  // Validate
  if (!category || !author || !text) {
    status.className = 'form-status error';
    status.textContent = 'Please fill in all fields';
    return;
  }
  
  // Show loading state
  submitBtn.innerHTML = '<span class="btn-icon">⏳</span> Posting...';
  submitBtn.disabled = true;
  status.className = 'form-status info';
  status.textContent = 'Posting comment...';
  
  try {
    const commentData = { category, author, text };
    console.log('💬 Adding comment to project:', currentProject.id, commentData);
    
    const newComment = await window.supabaseAPI.addComment(currentProject.id, commentData);
    console.log('✓ Comment added successfully:', newComment);
    
    // Clear form first
    document.getElementById('addCommentForm').reset();
    
    // Immediately reload comments to show the new one
    console.log('🔄 Reloading comments...');
    await loadComments(currentProject.id);
    
    // Show success message
    status.className = 'form-status success';
    status.textContent = '✓ Comment posted and visible below!';
    
    // Clear status after 3 seconds
    setTimeout(() => {
      status.className = 'form-status';
      status.textContent = '';
    }, 3000);
    
  } catch (error) {
    console.error('❌ Error adding comment:', error);
    status.className = 'form-status error';
    status.textContent = `Failed to post comment: ${error.message}`;
  } finally {
    // Re-enable button
    submitBtn.innerHTML = '<span class="btn-icon">💬</span> Post Comment';
    submitBtn.disabled = false;
  }
}

async function deleteComment(commentId) {
  if (!confirm('Are you sure you want to delete this comment?')) {
    return;
  }
  
  try {
    await window.supabaseAPI.deleteComment(commentId);
    
    // Reload comments
    await loadComments(currentProject.id);
    
    // Show success message
    const status = document.getElementById('comment-status');
    if (status) {
      status.className = 'form-status success';
      status.textContent = 'Comment deleted successfully!';
      
      setTimeout(() => {
        status.className = 'form-status';
        status.textContent = '';
      }, 3000);
    }
    
  } catch (error) {
    console.error('Error deleting comment:', error);
    const status = document.getElementById('comment-status');
    if (status) {
      status.className = 'form-status error';
      status.textContent = `Failed to delete comment: ${error.message}`;
    }
  }
}

// Gallery Media Functions
let galleryClient = null;
let currentGalleryProjects = [];

// Initialize gallery client
function initializeGalleryClient() {
  try {
    // Get Supabase configuration from existing setup
    const supabaseUrl = window.SUPABASE_URL || 'your-supabase-url';
    const supabaseKey = window.SUPABASE_ANON_KEY || 'your-supabase-key';
    
    if (supabaseUrl === 'your-supabase-url' || supabaseKey === 'your-supabase-key') {
      console.warn('Gallery client not initialized: Supabase credentials not found');
      return false;
    }
    
    galleryClient = new GalleryMediaClient(supabaseUrl, supabaseKey);
    console.log('Gallery client initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize gallery client:', error);
    return false;
  }
}

// Show gallery view
async function showGalleryView() {
  try {
    // Initialize gallery client if not already done
    if (!galleryClient) {
      if (!initializeGalleryClient()) {
        alert('Gallery functionality not available. Please check your Supabase configuration.');
        return;
      }
    }
    
    // Hide project grid and show gallery
    document.getElementById('projectGrid').style.display = 'none';
    document.getElementById('galleryView').style.display = 'block';
    
    // Load gallery data
    await loadGalleryData();
    
  } catch (error) {
    console.error('Error showing gallery view:', error);
    alert('Failed to load gallery view. Please try again.');
  }
}

// Hide gallery view
function hideGalleryView() {
  document.getElementById('projectGrid').style.display = 'grid';
  document.getElementById('galleryView').style.display = 'none';
}

// Load gallery data
async function loadGalleryData() {
  try {
    if (!galleryClient) {
      throw new Error('Gallery client not initialized');
    }
    
    const projects = await galleryClient.getProjectsWithMedia();
    currentGalleryProjects = projects;
    renderGallery(projects);
    
  } catch (error) {
    console.error('Error loading gallery data:', error);
    alert('Failed to load gallery data. Please check your database connection.');
  }
}

// Render gallery
function renderGallery(projects) {
  const galleryGrid = document.getElementById('galleryGrid');
  galleryGrid.innerHTML = '';
  
  if (projects.length === 0) {
    galleryGrid.innerHTML = '<div class="no-results">No media found. Upload some images or videos to see them here.</div>';
    return;
  }
  
  projects.forEach(project => {
    project.media.forEach(media => {
      const galleryItem = createGalleryItem(media, project);
      galleryGrid.appendChild(galleryItem);
    });
  });
}

// Create gallery item
function createGalleryItem(media, project) {
  const item = document.createElement('div');
  item.className = 'gallery-item';
  item.dataset.mediaId = media.id;
  item.dataset.projectId = project.project_id;
  
  const mediaElement = media.media_type === 'image' 
    ? `<img src="${media.public_url}" alt="${media.original_name}" loading="lazy">`
    : `<video src="${media.public_url}" poster="${media.thumbnail_url || ''}" muted></video>`;
  
  item.innerHTML = `
    ${mediaElement}
    <div class="media-info">
      <span class="media-type ${media.media_type}">${media.media_type.toUpperCase()}</span>
      <h3>${project.title}</h3>
      <p>${media.original_name}</p>
      ${media.duration ? `<p>Duration: ${formatDuration(media.duration)}</p>` : ''}
    </div>
  `;
  
  // Add click handler to open project modal
  item.addEventListener('click', () => {
    openProjectModal(project.project_id);
  });
  
  return item;
}

// Format duration
function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Filter gallery by media type
async function filterGalleryByType(mediaType) {
  try {
    if (!galleryClient) {
      throw new Error('Gallery client not initialized');
    }
    
    const projects = await galleryClient.getProjectsWithMedia({ mediaType });
    renderGallery(projects);
    
  } catch (error) {
    console.error('Error filtering gallery:', error);
    alert('Failed to filter gallery. Please try again.');
  }
}

// Get gallery statistics
async function getGalleryStatistics() {
  try {
    if (!galleryClient) {
      throw new Error('Gallery client not initialized');
    }
    
    const stats = await galleryClient.getGalleryStats();
    console.log('Gallery Statistics:', stats);
    return stats;
    
  } catch (error) {
    console.error('Error getting gallery statistics:', error);
    return null;
  }
}

// Lightbox function for full-screen image viewing
function showLightbox(imageUrl) {
  const lightboxOverlay = document.createElement('div');
  lightboxOverlay.className = 'lightbox';
  lightboxOverlay.innerHTML = `<img src="${imageUrl}" alt="Full size image" />`;
  
  // Close on click
  lightboxOverlay.addEventListener('click', () => {
    lightboxOverlay.remove();
  });
  
  document.body.appendChild(lightboxOverlay);
}

// Remove image from project
async function removeImageFromProject(imageUrl) {
  if (!currentProject) return;
  
  if (!confirm('Remove this image?')) return;
  
  try {
    await window.supabaseAPI.removeImageFromProject(currentProject.id, imageUrl);
    
    // Update local project data
    currentProject.image_urls = currentProject.image_urls.filter(url => url !== imageUrl);
    
    // Refresh the media display
    populateCurrentMedia(currentProject);
    
    alert('Image removed successfully!');
  } catch (error) {
    console.error('Error removing image:', error);
    alert('Failed to remove image: ' + error.message);
  }
}

// Remove video from project
async function removeVideoFromProject(videoUrl) {
  if (!currentProject) return;
  
  if (!confirm('Remove this video?')) return;
  
  try {
    await window.supabaseAPI.removeVideoFromProject(currentProject.id, videoUrl);
    
    // Update local project data
    currentProject.video_urls = currentProject.video_urls.filter(url => url !== videoUrl);
    
    // Refresh the media display
    populateCurrentMedia(currentProject);
    
    alert('Video removed successfully!');
  } catch (error) {
    console.error('Error removing video:', error);
    alert('Failed to remove video: ' + error.message);
  }
}

// Clear rating in edit mode
function clearEditRating() {
  const editStars = document.querySelectorAll('#edit_rating .star');
  editStars.forEach(star => {
    star.classList.remove('active');
  });
}

// Delete current project from edit modal
async function deleteCurrentProject() {
  if (!currentProject) {
    alert('No project selected');
    return;
  }
  
  if (!confirm(`Are you sure you want to delete "${currentProject.title}"? This action cannot be undone.`)) {
    return;
  }
  
  try {
    // Use supabaseAPI to delete
    await window.supabaseAPI.deleteProject(currentProject.id);
    
    // Close modal
    closeProjectModal();
    
    // Refresh the project list
    if (typeof fetchProjects === 'function') {
      await fetchProjects();
    }
    
    alert('Project deleted successfully!');
  } catch (error) {
    console.error('Error deleting project:', error);
    alert(`Failed to delete project: ${error.message}`);
  }
}

// Setup category description functionality
function setupCategoryDescription() {
  const categorySelect = document.getElementById('commentCategory');
  const descriptionDiv = document.getElementById('categoryDescription');
  
  if (!categorySelect || !descriptionDiv) return;
  
  const descriptions = {
    '1': 'Share in which type of exhibition, format, presentation style, or display approach this project fits best. E.g. Display case, Experiment, Technium 2028, Fenomena etc.',
    '2': 'Describe potential opportunities this project creates, future applications, or areas for expansion.',
    '3': 'Could there be any challenges in creating this project?',
    '4': 'Which values of the Visitor Experience taxonomy do you think are most important for this project? [Kennis & Inizicht, Onderzoeken & Ontwerpen, Reflecteren, Opwinding & Inspiratie, Identificeren met wetenschap, Deelnemen aan onderzoerk]',
    '5': 'Share any general thoughts, feedback, or observations about this project that don\'t fit into the other categories.'
  };
  
  function updateDescription() {
    const selectedValue = categorySelect.value;
    if (selectedValue && descriptions[selectedValue]) {
      descriptionDiv.textContent = descriptions[selectedValue];
      descriptionDiv.style.display = 'flex';
    } else {
      descriptionDiv.textContent = '';
      descriptionDiv.style.display = 'none';
    }
  }
  
  // Update on change
  categorySelect.addEventListener('change', updateDescription);
  
  // Initial update
  updateDescription();
}

// Setup modal rating functionality
function setupModalRatingHandlers() {
  const ratingElement = document.getElementById('modalRating');
  if (!ratingElement) {
    console.warn('Modal rating element not found');
    return;
  }
  
  const stars = ratingElement.querySelectorAll('.star');
  if (stars.length === 0) {
    console.warn('No rating stars found');
    return;
  }
  
  console.log('Setting up rating handlers for', stars.length, 'stars');
  
  // Add click handlers to each star
  stars.forEach((star, index) => {
    // Clone the node to remove old event listeners
    const newStar = star.cloneNode(true);
    star.parentNode.replaceChild(newStar, star);
    
    // Add new event listener
    newStar.addEventListener('click', function(event) {
      event.preventDefault();
      event.stopPropagation();
      
      const clickedRating = parseInt(this.getAttribute('data-rating'));
      const projectId = ratingElement.getAttribute('data-project-id');
      
      console.log('Star clicked:', clickedRating, 'Project:', projectId);
      
      if (!projectId) {
        console.error('No project ID found');
        return;
      }
      
      // Update visual display
      const allStars = ratingElement.querySelectorAll('.star');
      allStars.forEach((s, i) => {
        if (i < clickedRating) {
          s.classList.add('active');
        } else {
          s.classList.remove('active');
        }
      });
      
      // Update project rating in database
      updateProjectRating(projectId, clickedRating);
    });
  });
}

// Update project rating
async function updateProjectRating(projectId, rating) {
  try {
    // Update current project data
    if (currentProject && currentProject.id == projectId) {
      currentProject.rating = rating;
    }
    
    // Update in database
    await window.supabaseAPI.updateProject(projectId, { rating: rating });
    
    console.log(`✅ Rating updated to ${rating} stars for project ${projectId}`);
    
    // Show brief success feedback
    const ratingElement = document.getElementById('modalRating');
    if (ratingElement) {
      const originalBg = ratingElement.style.background;
      ratingElement.style.background = '#d1fae5';
      ratingElement.style.transition = 'background 0.3s ease';
      setTimeout(() => {
        ratingElement.style.background = originalBg;
      }, 500);
    }
    
    // Refresh the gallery to show updated rating
    if (typeof fetchProjects === 'function') {
      fetchProjects();
    }
  } catch (error) {
    console.error('❌ Error updating rating:', error);
    alert('Failed to update rating. Please try again.');
  }
}

// Clear modal rating
async function clearModalRating() {
  const ratingElement = document.getElementById('modalRating');
  if (!ratingElement) return;
  
  const projectId = ratingElement.getAttribute('data-project-id');
  if (!projectId) return;
  
  try {
    // Clear visual display
    const stars = ratingElement.querySelectorAll('.star');
    stars.forEach(star => star.classList.remove('active'));
    
    // Update current project data
    if (currentProject && currentProject.id == projectId) {
      currentProject.rating = 0;
    }
    
    // Update in database
    await window.supabaseAPI.updateProject(projectId, { rating: 0 });
    
    console.log(`✅ Rating cleared for project ${projectId}`);
    
    // Show brief success feedback
    const originalBg = ratingElement.style.background;
    ratingElement.style.background = '#fee2e2';
    ratingElement.style.transition = 'background 0.3s ease';
    setTimeout(() => {
      ratingElement.style.background = originalBg;
    }, 500);
    
    // Refresh the gallery to show updated rating
    if (typeof fetchProjects === 'function') {
      fetchProjects();
    }
  } catch (error) {
    console.error('❌ Error clearing rating:', error);
    alert('Failed to clear rating. Please try again.');
  }
}

// Open Instructions PDF
function openInstructions() {
  window.open('Instructions_MusealeZaken.pdf', '_blank');
}

// Expose functions to window for inline onclick handlers
window.openProjectModal = openProjectModal;
window.closeProjectModal = closeProjectModal;
window.toggleEditMode = toggleEditMode;
window.showLightbox = showLightbox;
window.removeImageFromProject = removeImageFromProject;
window.removeVideoFromProject = removeVideoFromProject;
window.clearEditRating = clearEditRating;
window.deleteCurrentProject = deleteCurrentProject;
window.clearModalRating = clearModalRating;
window.openInstructions = openInstructions;
window.navigateToPreviousProject = navigateToPreviousProject;
window.navigateToNextProject = navigateToNextProject;
window.filterByCategory = filterByCategory;
