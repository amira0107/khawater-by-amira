/**
 * Khawater - Whispers of the Soul
 * JavaScript Application Logic
 */

// Configuration et variables globales
const CONFIG = {
    SUPABASE_URL: 'https://khawater.supabase.com', 
    SUPABASE_ANON_KEY: 'khawater amira', 
    MAX_POST_LENGTH: 280,
    POSTS_PER_PAGE: 20,
    STORAGE_KEY: 'khawater_posts'
};

// État global de l'application
let appState = {
    posts: [],
    currentUser: {
        id: null,
        name: 'مستخدم مجهول',
        isAnonymous: true
    },
    isLoading: false,
    postCounter: 0
};

// Classes et utilitaires
class SupabaseClient {
    constructor(url, key) {
        this.url = url;
        this.key = key;
        this.isConfigured = url && key && !url.includes('votre-projet');
    }
    
    async request(path, options = {}) {
        if (!this.isConfigured) {
            throw new Error('Supabase non configuré');
        }
        
        const response = await fetch(`${this.url}/rest/v1${path}`, {
            headers: {
                'apikey': this.key,
                'Authorization': `Bearer ${this.key}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Erreur ${response.status}: ${error}`);
        }
        
        const text = await response.text();
        return text ? JSON.parse(text) : null;
    }
    
    async select(table, options = {}) {
        let path = `/${table}?select=*`;
        
        if (options.order) {
            path += `&order=${options.order}`;
        }
        if (options.limit) {
            path += `&limit=${options.limit}`;
        }
        if (options.offset) {
            path += `&offset=${options.offset}`;
        }
        
        return this.request(path);
    }
    
    async insert(table, data) {
        return this.request(`/${table}`, {
            method: 'POST',
            body: JSON.stringify(Array.isArray(data) ? data : [data])
        });
    }
    
    async update(table, data, filter) {
        return this.request(`/${table}?${filter}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }
    
    async delete(table, filter) {
        return this.request(`/${table}?${filter}`, {
            method: 'DELETE'
        });
    }
}

// Initialisation du client Supabase
const supabase = new SupabaseClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// Utilitaires
const utils = {
    // Sanitiser le texte
    sanitizeText(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    // Calculer le temps écoulé
    getTimeAgo(date) {
        const now = new Date();
        const diffInSeconds = Math.floor((now - new Date(date)) / 1000);
        
        if (diffInSeconds < 60) return 'الآن';
        
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        if (diffInMinutes < 60) return `${diffInMinutes}د`;
        
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours}س`;
        
        const diffInDays = Math.floor(diffInHours / 24);
        if (diffInDays < 7) return `${diffInDays}ي`;
        
        return new Date(date).toLocaleDateString('ar-SA', {
            month: 'short',
            day: 'numeric'
        });
    },
    
    // Extraire les hashtags
    extractHashtags(text) {
        const hashtagRegex = /#[\u0600-\u06FF\w]+/g;
        return text.match(hashtagRegex) || [];
    },
    
    // Formater le contenu avec hashtags
    formatContent(content) {
        return content.replace(/#([\u0600-\u06FF\w]+)/g, 
            '<span class="hashtag text-purple-600 font-medium">#$1</span>');
    },
    
    // Générer un ID unique
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },
    
    // Sauvegarder localement
    saveToLocal(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.warn('Impossible de sauvegarder localement:', error);
        }
    },
    
    // Charger depuis le local
    loadFromLocal(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.warn('Impossible de charger depuis le local:', error);
            return null;
        }
    }
};

// Gestionnaire de notifications
const notifications = {
    show(message, type = 'success', duration = 3000) {
        const notification = document.getElementById('notification');
        const icon = notification.querySelector('.notification-icon');
        const text = notification.querySelector('.notification-text');
        
        // Définir l'icône selon le type
        const icons = {
            success: 'fas fa-check-circle text-green-500',
            error: 'fas fa-exclamation-circle text-red-500',
            warning: 'fas fa-exclamation-triangle text-yellow-500',
            info: 'fas fa-info-circle text-blue-500'
        };
        
        icon.className = icons[type] || icons.success;
        text.textContent = message;
        
        notification.classList.remove('hidden');
        
        setTimeout(() => {
            notification.classList.add('hidden');
        }, duration);
    },
    
    hide() {
        document.getElementById('notification').classList.add('hidden');
    }
};

// Gestionnaire de posts
const postManager = {
    // Créer un nouveau post
    async create(content, mood, isAnonymous) {
        const post = {
            id: utils.generateId(),
            content: utils.sanitizeText(content.trim()),
            mood: mood || 'emerald',
            is_anonymous: isAnonymous,
            author: isAnonymous ? 'مجهول' : appState.currentUser.name,
            hashtags: utils.extractHashtags(content),
            likes_count: 0,
            created_at: new Date().toISOString()
        };
        
        try {
            // Essayer de sauver sur Supabase
            if (supabase.isConfigured) {
                const result = await supabase.insert('posts', post);
                if (result && result.length > 0) {
                    post.id = result[0].id;
                }
            }
            
            // Ajouter à l'état local
            appState.posts.unshift(post);
            
            // Sauvegarder localement
            utils.saveToLocal(CONFIG.STORAGE_KEY, appState.posts);
            
            return post;
        } catch (error) {
            console.error('Erreur création post:', error);
            // Fallback local uniquement
            appState.posts.unshift(post);
            utils.saveToLocal(CONFIG.STORAGE_KEY, appState.posts);
            return post;
        }
    },
    
    // Charger les posts
    async load() {
        try {
            appState.isLoading = true;
            ui.showLoading();
            
            if (supabase.isConfigured) {
                const data = await supabase.select('posts', {
                    order: 'created_at.desc',
                    limit: CONFIG.POSTS_PER_PAGE
                });
                
                if (data && data.length > 0) {
                    appState.posts = data.map(post => ({
                        ...post,
                        hashtags: post.hashtags || [],
                        isLiked: false // À implémenter avec authentification
                    }));
                    
                    utils.saveToLocal(CONFIG.STORAGE_KEY, appState.posts);
                    return appState.posts;
                }
            }
            
            // Fallback vers données locales ou exemples
            const localPosts = utils.loadFromLocal(CONFIG.STORAGE_KEY);
            if (localPosts && localPosts.length > 0) {
                appState.posts = localPosts;
            } else {
                appState.posts = this.getSamplePosts();
                utils.saveToLocal(CONFIG.STORAGE_KEY, appState.posts);
            }
            
            return appState.posts;
        } catch (error) {
            console.error('Erreur chargement posts:', error);
            notifications.show('خطأ في تحميل المشاركات', 'error');
            
            // Fallback vers données locales
            const localPosts = utils.loadFromLocal(CONFIG.STORAGE_KEY);
            appState.posts = localPosts || this.getSamplePosts();
            return appState.posts;
        } finally {
            appState.isLoading = false;
            ui.hideLoading();
        }
    },
    
    // Like/Unlike un post
    async toggleLike(postId) {
        const post = appState.posts.find(p => p.id == postId);
        if (!post) return;
        
        try {
            const wasLiked = post.isLiked;
            const newLikesCount = wasLiked ? post.likes_count - 1 : post.likes_count + 1;
            
            // Mise à jour optimiste
            post.isLiked = !wasLiked;
            post.likes_count = newLikesCount;
            
            // Mise à jour de l'affichage
            ui.updatePostLike(postId, post.isLiked, post.likes_count);
            
            // Sauvegarder localement
            utils.saveToLocal(CONFIG.STORAGE_KEY, appState.posts);
            
            // Mettre à jour sur Supabase si configuré
            if (supabase.isConfigured) {
                await supabase.update('posts', 
                    { likes_count: newLikesCount }, 
                    `id=eq.${postId}`
                );
            }
        } catch (error) {
            console.error('Erreur toggle like:', error);
            // Annuler la mise à jour optimiste
            post.isLiked = !post.isLiked;
            post.likes_count = post.isLiked ? post.likes_count + 1 : post.likes_count - 1;
            ui.updatePostLike(postId, post.isLiked, post.likes_count);
        }
    },
    
    // Posts d'exemple
    getSamplePosts() {
        return [
            {
                id: 1,
                content: 'بدأت رحلة التأمل منذ شهر وأشعر بتحسن كبير في مزاجي وسلامي الداخلي. التأمل لمدة 10 دقائق يومياً غيّر حياتي حقاً 🌱✨',
                mood: 'emerald',
                is_anonymous: false,
                author: 'سارة النور',
                hashtags: ['#التأمل', '#السلام_النفسي'],
                likes_count: 23,
                isLiked: false,
                created_at: new Date(Date.now() - 1800000).toISOString()
            },
            {
                id: 2,
                content: 'أحياناً نحتاج فقط لشخص يسمعنا دون إصدار أحكام. شكراً لهذا المجتمع الرائع على كونه مساحة آمنة للجميع 💙🤗',
                mood: 'ocean',
                is_anonymous: true,
                author: 'مجهول',
                hashtags: ['#الدعم_المجتمعي', '#الأمان'],
                likes_count: 67,
                isLiked: true,
                created_at: new Date(Date.now() - 3600000).toISOString()
            },
            {
                id: 3,
                content: 'اليوم تذكرت أن كل خطوة صغيرة نحو الأفضل تستحق الاحتفال. لا تستهين بالتقدم البسيط 🌈💪',
                mood: 'amber',
                is_anonymous: false,
                author: 'أحمد الأمل',
                hashtags: ['#التقدير_الذاتي', '#الامتنان'],
                likes_count: 45,
                isLiked: false,
                created_at: new Date(Date.now() - 7200000).toISOString()
            }
        ];
    }
};

// Gestionnaire de l'interface utilisateur
const ui = {
    // Initialiser l'interface
    init() {
        this.bindEvents();
        this.updateCharCounter();
        this.updateAvatar();
    },
    
    // Lier les événements
    bindEvents() {
        // Formulaire de post
        const postForm = document.getElementById('post-form');
        if (postForm) {
            postForm.addEventListener('submit', this.handlePostSubmit.bind(this));
        }
        
        // Textarea du post
        const postContent = document.getElementById('post-content');
        if (postContent) {
            postContent.addEventListener('input', this.updateCharCounter.bind(this));
            postContent.addEventListener('keydown', this.handleKeyDown.bind(this));
        }
        
        // Sélecteur d'humeur
        const moodSelector = document.getElementById('mood-selector');
        if (moodSelector) {
            moodSelector.addEventListener('change', this.updateAvatar.bind(this));
        }
        
        // Bouton de post
        const postBtn = document.getElementById('post-btn');
        if (postBtn) {
            postBtn.addEventListener('click', this.handlePostSubmit.bind(this));
        }
    },
    
    // Gérer la soumission du post
    async handlePostSubmit(event) {
        if (event) {
            event.preventDefault();
        }
        
        const content = document.getElementById('post-content').value.trim();
        const mood = document.getElementById('mood-selector').value;
        const isAnonymous = document.getElementById('anonymous-toggle').checked;
        
        // Validation
        if (!content) {
            notifications.show('الرجاء كتابة محتوى للهمسة', 'warning');
            return;
        }
        
        if (content.length > CONFIG.MAX_POST_LENGTH) {
            notifications.show(`النص طويل جداً (الحد الأقصى ${CONFIG.MAX_POST_LENGTH} حرف)`, 'warning');
            return;
        }
        
        try {
            // Désactiver le bouton
            const postBtn = document.getElementById('post-btn');
            const originalText = postBtn.innerHTML;
            postBtn.disabled = true;
            postBtn.innerHTML = '<span class="spinner"></span> جاري النشر...';
            
            // Créer le post
            await postManager.create(content, mood, isAnonymous);
            
            // Nettoyer le formulaire
            document.getElementById('post-content').value = '';
            this.updateCharCounter();
            
            // Actualiser l'affichage
            this.renderPosts();
            
            notifications.show('تم نشر همستك بنجاح! 🎉', 'success');
            
        } catch (error) {
            console.error('Erreur publication:', error);
            notifications.show('خطأ في النشر، حاول مرة أخرى', 'error');
        } finally {
            // Réactiver le bouton
            const postBtn = document.getElementById('post-btn');
            postBtn.disabled = false;
            postBtn.innerHTML = 'نشر همسة';
        }
    },
    
    // Gérer les raccourcis clavier
    handleKeyDown(event) {
        // Ctrl+Enter ou Cmd+Enter pour publier
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            this.handlePostSubmit();
        }
    },
    
    // Mettre à jour le compteur de caractères
    updateCharCounter() {
        const content = document.getElementById('post-content').value;
        const counter = document.getElementById('char-count');
        const progress = document.getElementById('char-progress-bar');
        const postBtn = document.getElementById('post-btn');
        
        if (!counter || !progress || !postBtn) return;
        
        const remaining = CONFIG.MAX_POST_LENGTH - content.length;
        const percentage = (content.length / CONFIG.MAX_POST_LENGTH) * 100;
        
        counter.textContent = remaining;
        progress.style.width = `${Math.min(percentage, 100)}%`;
        
        // Changer la couleur selon le pourcentage
        if (percentage > 90) {
            progress.style.background = '#ef4444';
            counter.style.color = '#ef4444';
        } else if (percentage > 75) {
            progress.style.background = '#f59e0b';
            counter.style.color = '#f59e0b';
        } else {
            progress.style.background = '#10b981';
            counter.style.color = '#6b7280';
        }
        
        // Désactiver le bouton si vide ou trop long
        postBtn.disabled = content.trim().length === 0 || remaining < 0;
    },
    
    // Mettre à jour l'avatar selon l'humeur
    updateAvatar() {
        const mood = document.getElementById('mood-selector').value;
        const avatars = document.querySelectorAll('.post-avatar, #user-avatar');
        
        avatars.forEach(avatar => {
            avatar.className = avatar.className.replace(/mood-\w+/, `mood-${mood}`);
        });
    },
    
    // Afficher les posts
    renderPosts() {
        const timeline = document.getElementById('timeline');
        if (!timeline) return;
        
        timeline.innerHTML = '';
        
        if (appState.posts.length === 0) {
            timeline.innerHTML = `
                <div class="card-professional rounded-3xl p-8 text-center">
                    <i class="fas fa-heart text-purple-400 text-4xl mb-4"></i>
                    <h3 class="text-xl font-bold text-gray-800 mb-2">لا توجد همسات بعد</h3>
                    <p class="text-gray-600">كن أول من يشارك همسة في هذا المجتمع</p>
                </div>
            `;
            return;
        }
        
        appState.posts.forEach(post => {
            const postElement = this.createPostElement(post);
            timeline.appendChild(postElement);
        });
    },
    
    // Créer un élément post
    createPostElement(post) {
        const div = document.createElement('div');
        div.className = 'post-card';
        div.setAttribute('data-post-id', post.id);
        
        const timeAgo = utils.getTimeAgo(post.created_at);
        const moodClass = `mood-${post.mood}`;
        const formattedContent = utils.formatContent(post.content);
        
        div.innerHTML = `
            <div class="flex gap-4">
                <div class="post-avatar ${moodClass}">
                    <i class="fas fa-user"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="post-header">
                        <span class="post-author">${post.author}</span>
                        <span class="post-time">منذ ${timeAgo}</span>
                    </div>
                    <div class="post-content">
                        ${formattedContent}
                    </div>
                    <div class="post-actions">
                        <button class="post-action like-btn ${post.isLiked ? 'liked' : ''}" 
                                onclick="handleLikeClick(${post.id})">
                            <i class="${post.isLiked ? 'fas' : 'far'} fa-heart"></i>
                            <span class="like-count">${post.likes_count}</span>
                        </button>
                        <button class="post-action">
                            <i class="far fa-comment"></i>
                            <span>0</span>
                        </button>
                        <button class="post-action">
                            <i class="far fa-share-square"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        return div;
    },
    
    // Mettre à jour l'affichage d'un like
    updatePostLike(postId, isLiked, likesCount) {
        const postElement = document.querySelector(`[data-post-id="${postId}"]`);
        if (!postElement) return;
        
        const likeBtn = postElement.querySelector('.like-btn');
        const likeIcon = likeBtn.querySelector('i');
        const likeCount = likeBtn.querySelector('.like-count');
        
        if (isLiked) {
            likeBtn.classList.add('liked');
            likeIcon.classList.replace('far', 'fas');
        } else {
            likeBtn.classList.remove('liked');
            likeIcon.classList.replace('fas', 'far');
        }
        
        likeCount.textContent = likesCount;
    },
    
    // Afficher le loading
    showLoading() {
        const timeline = document.getElementById('timeline');
        if (timeline) {
            timeline.innerHTML = `
                <div class="text-center py-8">
                    <div class="spinner mx-auto mb-4"></div>
                    <p class="text-gray-600">جاري تحميل الهمسات...</p>
                </div>
            `;
        }
    },
    
    // Masquer le loading
    hideLoading() {
        // Le loading sera remplacé par les posts
    }
};

// Fonctions globales (appelées depuis le HTML)
window.handleLikeClick = function(postId) {
    postManager.toggleLike(postId);
};

window.publishPost = function() {
    ui.handlePostSubmit();
};

// Initialisation de l'application
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🌸 Initialisation de Khawater...');
    
    try {
        // Initialiser l'interface
        ui.init();
        
        // Charger les posts
        await postManager.load();
        
        // Afficher les posts
        ui.renderPosts();
        
        console.log('✅ Khawater initialisé avec succès');
        
        // Message de bienvenue
        setTimeout(() => {
            notifications.show('مرحباً بك في خواطر - همسات الروح 🌸', 'info', 4000);
        }, 1000);
        
    } catch (error) {
        console.error('❌ Erreur initialisation:', error);
        notifications.show('خطأ في تحميل التطبيق', 'error');
    }
});

// Service Worker pour PWA (optionnel)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
            .then(function(registration) {
                console.log('SW registered: ', registration);
            })
            .catch(function(registrationError) {
                console.log('SW registration failed: ', registrationError);
            });
    });
}