// Local JSON client for Student Projects
// Replaces Supabase at runtime. It reads Website/data/projects.json, keeps edits
// in browser localStorage, and lets users download the updated projects.json.

(function () {
  const DATA_URL = 'data/projects.json';
  const STORAGE_KEY = 'student-projects-local-json-v1';
  let projects = [];
  let loaded = false;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function toArray(value) {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'string' && value.trim()) {
      return value.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
  }

  function normaliseProject(project, index = 0) {
    const now = new Date().toISOString();
    const id = project.id ?? project.project_id ?? index + 1;
    const imageUrls = toArray(project.image_urls);
    const videoUrls = toArray(project.video_urls);
    return {
      id: Number.isFinite(Number(id)) ? Number(id) : id,
      title: project.title || 'Untitled project',
      student_name: project.student_name || project.student || project.students || '',
      description: project.description || '',
      year: project.year ? Number(project.year) : null,
      curator: project.curator || project.editor || '',
      rating: project.rating ? Number(project.rating) : 0,
      tags: Array.isArray(project.tags) ? project.tags.join(', ') : (project.tags || ''),
      category: project.category || '',
      categories: toArray(project.categories || project.category),
      project_link: project.project_link || project.link || '',
      github_repo: project.github_repo || '',
      documentation: project.documentation || '',
      feedback: project.feedback || '',
      video_url: project.video_url || '',
      image_urls: imageUrls,
      video_urls: videoUrls,
      comments: Array.isArray(project.comments) ? project.comments : [],
      created_at: project.created_at || now,
      updated_at: project.updated_at || now,
      image_count: imageUrls.length,
      video_count: videoUrls.length + (project.video_url ? 1 : 0),
      thumbnail_image: imageUrls[0] || project.thumbnail_image || null,
      thumbnail_video: videoUrls[0] || project.thumbnail_video || null,
      comment_count: Array.isArray(project.comments) ? project.comments.length : 0
    };
  }

  function enrich(project) {
    return normaliseProject(project);
  }

  function saveToLocalStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects, null, 2));
    showExportNotice();
  }

  async function loadProjects() {
    if (loaded) return projects;

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      projects = JSON.parse(saved).map(normaliseProject);
      loaded = true;
      showExportNotice('Loaded locally edited data. Download projects.json to make it permanent in the repo.');
      return projects;
    }

    try {
      const response = await fetch(DATA_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Could not load ${DATA_URL}: ${response.status}`);
      const raw = await response.json();
      const list = Array.isArray(raw) ? raw : (raw.projects || []);
      projects = list.map(normaliseProject);
    } catch (error) {
      console.warn('Starting with empty project list:', error);
      projects = [];
    }

    loaded = true;
    return projects;
  }

  function nextProjectId() {
    const numericIds = projects.map(p => Number(p.id)).filter(Number.isFinite);
    return numericIds.length ? Math.max(...numericIds) + 1 : 1;
  }

  function nextCommentId() {
    const ids = projects.flatMap(p => (p.comments || []).map(c => Number(c.id))).filter(Number.isFinite);
    return ids.length ? Math.max(...ids) + 1 : 1;
  }

  function applyFilters(items, params = {}) {
    let rows = items.map(enrich);
    if (params.q) {
      const q = String(params.q).toLowerCase();
      rows = rows.filter(p => [p.title, p.student_name, p.description, p.tags].some(v => String(v || '').toLowerCase().includes(q)));
    }
    if (params.year) rows = rows.filter(p => String(p.year || '') === String(params.year));
    if (params.curator) rows = rows.filter(p => p.curator === params.curator);
    if (params.rating) rows = rows.filter(p => Number(p.rating || 0) >= Number(params.rating));

    const sortField = params.sort || params.sortBy || 'title';
    const sortOrder = params.order || params.sortOrder || 'asc';
    rows.sort((a, b) => {
      let av = a[sortField] ?? '';
      let bv = b[sortField] ?? '';
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      if (av === bv) return 0;
      return sortOrder === 'desc' ? (av < bv ? 1 : -1) : (av > bv ? 1 : -1);
    });
    return rows;
  }

  function cleanProjectData(data) {
    const cleaned = normaliseProject(data, projects.length);
    cleaned.updated_at = new Date().toISOString();
    return cleaned;
  }

  function downloadProjectsJson() {
    const data = JSON.stringify(projects.map(enrich), null, 2) + '\n';
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'projects.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function clearLocalEdits() {
    if (!confirm('Discard all browser-local edits and reload data/projects.json from the repo?')) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }

  function showExportNotice(message) {
    const existing = document.getElementById('local-json-toolbar');
    if (existing) {
      const msg = existing.querySelector('.local-json-message');
      if (msg && message) msg.textContent = message;
      return;
    }
    if (!document.body) return;

    const bar = document.createElement('div');
    bar.id = 'local-json-toolbar';
    bar.style.cssText = 'position:sticky;top:0;z-index:9999;background:#fff8d8;border-bottom:1px solid #e5c94c;color:#4a3a00;padding:10px 14px;display:flex;gap:12px;align-items:center;justify-content:center;flex-wrap:wrap;font:14px system-ui,sans-serif;';
    bar.innerHTML = `
      <span class="local-json-message">Local JSON mode: edits are saved in this browser. Download projects.json and replace Website/data/projects.json before committing.</span>
      <button id="download-projects-json" type="button" style="padding:6px 10px;border:1px solid #9a7b00;background:white;border-radius:6px;cursor:pointer;">Download projects.json</button>
      <button id="discard-local-json" type="button" style="padding:6px 10px;border:1px solid #999;background:white;border-radius:6px;cursor:pointer;">Discard local edits</button>
    `;
    document.body.prepend(bar);
    document.getElementById('download-projects-json').addEventListener('click', downloadProjectsJson);
    document.getElementById('discard-local-json').addEventListener('click', clearLocalEdits);
  }

  const localJsonAPI = {
    async fetchProjects(params = {}) {
      await loadProjects();
      return applyFilters(projects, params);
    },

    async getProject(id) {
      await loadProjects();
      const project = projects.find(p => String(p.id) === String(id));
      if (!project) throw new Error(`Project ${id} not found`);
      return enrich(project);
    },

    async createProject(projectData) {
      await loadProjects();
      const project = cleanProjectData({ ...projectData, id: nextProjectId(), created_at: new Date().toISOString() });
      projects.push(project);
      saveToLocalStorage();
      return enrich(project);
    },

    async updateProject(id, projectData) {
      await loadProjects();
      const index = projects.findIndex(p => String(p.id) === String(id));
      if (index === -1) throw new Error(`Project ${id} not found`);
      projects[index] = cleanProjectData({ ...projects[index], ...projectData, id: projects[index].id });
      saveToLocalStorage();
      return enrich(projects[index]);
    },

    async deleteProject(id) {
      await loadProjects();
      projects = projects.filter(p => String(p.id) !== String(id));
      saveToLocalStorage();
    },

    async addComment(projectId, commentData) {
      await loadProjects();
      const project = projects.find(p => String(p.id) === String(projectId));
      if (!project) throw new Error(`Project ${projectId} not found`);
      const comment = {
        id: nextCommentId(),
        project_id: project.id,
        category: commentData.category || commentData.type || 'General',
        author: commentData.author || '',
        comment_text: commentData.comment_text || commentData.text || '',
        created_at: new Date().toISOString()
      };
      project.comments = project.comments || [];
      project.comments.push(comment);
      saveToLocalStorage();
      return comment;
    },

    async getComments(projectId) {
      await loadProjects();
      const project = projects.find(p => String(p.id) === String(projectId));
      return project && Array.isArray(project.comments) ? clone(project.comments) : [];
    },

    async deleteComment(commentId) {
      await loadProjects();
      for (const project of projects) {
        project.comments = (project.comments || []).filter(c => String(c.id) !== String(commentId));
      }
      saveToLocalStorage();
    },

    async uploadAndAddImage(file, projectId) {
      await loadProjects();
      const localPath = `data/media/project-${projectId}/${file.name}`;
      const project = projects.find(p => String(p.id) === String(projectId));
      if (!project) throw new Error(`Project ${projectId} not found`);
      project.image_urls = project.image_urls || [];
      project.image_urls.push(localPath);
      saveToLocalStorage();
      alert(`Image filename added to JSON as ${localPath}. Please manually place the file in that repo folder before committing.`);
      return localPath;
    },

    async uploadAndAddVideo(file, projectId) {
      await loadProjects();
      const localPath = `data/media/project-${projectId}/${file.name}`;
      const project = projects.find(p => String(p.id) === String(projectId));
      if (!project) throw new Error(`Project ${projectId} not found`);
      project.video_urls = project.video_urls || [];
      project.video_urls.push(localPath);
      saveToLocalStorage();
      alert(`Video filename added to JSON as ${localPath}. Please manually place the file in that repo folder before committing.`);
      return localPath;
    },

    async addImageToProject(projectId, imageUrl) {
      const project = await this.getProject(projectId);
      const urls = project.image_urls || [];
      urls.push(imageUrl);
      return this.updateProject(projectId, { image_urls: urls });
    },

    async addVideoToProject(projectId, videoUrl) {
      const project = await this.getProject(projectId);
      const urls = project.video_urls || [];
      urls.push(videoUrl);
      return this.updateProject(projectId, { video_urls: urls });
    },

    async removeImageFromProject(projectId, imageUrl) {
      const project = await this.getProject(projectId);
      return this.updateProject(projectId, { image_urls: (project.image_urls || []).filter(url => url !== imageUrl) });
    },

    async removeVideoFromProject(projectId, videoUrl) {
      const project = await this.getProject(projectId);
      return this.updateProject(projectId, { video_urls: (project.video_urls || []).filter(url => url !== videoUrl) });
    },

    downloadProjectsJson,
    clearLocalEdits
  };

  window.localJsonAPI = localJsonAPI;
  // Compatibility name used by the existing app code.
  window.supabaseAPI = localJsonAPI;

  document.addEventListener('DOMContentLoaded', () => {
    showExportNotice('Local JSON mode: add one test project, then use Download projects.json and replace Website/data/projects.json.');
  });
})();
