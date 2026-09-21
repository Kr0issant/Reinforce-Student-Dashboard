export type TrackType = "Kaggle" | "Product" | "Research" | "General";
export type HealthStatus = "on_track" | "at_risk" | "need_progress" | "completed";
export type TicketStatus = "open" | "in_progress" | "resolved" | "pending_approval";
export type PriorityType = "high" | "medium" | "low";

export interface UserProfile {
  id: string;
  name: string;
  initials: string;
  email: string;
  track: TrackType;
  tier: "Beginner" | "Advanced Member" | "Core Team";
  points: number;
  reputation: number;
  avatarUrl?: string;
  bio: string;
  location: string;
  joinedDate: string;
  skills: string[];
  links: {
    github?: string;
    kaggle?: string;
    discord?: string;
    portfolio?: string;
  };
  eventWins: {
    id: string;
    title: string;
    placement: string;
    track: string;
    date: string;
  }[];
  verifiedSubmissions: {
    id: string;
    title: string;
    timestamp: string;
    spgId: string;
  }[];
}

export interface SPGMember {
  name: string;
  role: string;
  initials: string;
  avatarColor?: string;
}

export interface ResourceRequest {
  id: string;
  name: string;
  detail: string;
  status: "approved" | "pending_review" | "rejected";
  allocationId?: string;
}

export interface MilestoneReport {
  id: string;
  period: string;
  submittedAt: string;
  summary: string;
  milestones: string[];
  blockers: string;
  nextSteps: string;
  approved: boolean;
}

export interface SPGProject {
  id: string; // e.g. "SPG-2024-089"
  title: string;
  track: TrackType;
  health: HealthStatus;
  progress: number;
  description: string;
  leadMember: string;
  leadEmail?: string;
  nextDeadline?: string;
  lastActivity?: string;
  members: SPGMember[];
  latestReport?: {
    period: string;
    milestones: string[];
    blockers: string;
    nextSteps: string;
  };
  resourceRequests: ResourceRequest[];
  timeline: {
    title: string;
    date: string;
    completed: boolean;
  }[];
  reports: MilestoneReport[];
}

export interface TicketItem {
  id: string; // e.g. "#TK-8842"
  title: string;
  category: "resource_request" | "spg_registration" | "misconduct" | "support_inquiry" | "feedback" | "misc";
  categoryLabel: string;
  status: TicketStatus;
  priority: PriorityType;
  track: TrackType;
  createdAt: string;
  createdRelative: string;
  author: string;
  description?: string;
  threadUrl?: string;
  archived?: boolean;
}

export interface ClubEvent {
  id: string;
  title: string;
  category: "Hackathon" | "Workshop" | "Meetup" | "Sprint" | "Discussion" | "Datathon" | "Exhibition";
  date: string;
  dayNumber?: number;
  monthDay: { month: string; day: string };
  time: string;
  location: string;
  track: TrackType;
  description: string;
  rsvpCount: number;
  userRsvp?: boolean;
  statusLabel?: string;
  statusType?: "registered" | "available" | "limited" | "full";
}

export interface ArticleItem {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  authorTrack: TrackType;
  publishDate: string;
  views: string;
  readTime: string;
  tags: string[];
  peerReviewed?: boolean;
  isPaper?: boolean;
}

export interface IdeaItem {
  id: string;
  title: string;
  track: TrackType;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  skillsRequired: string[];
  learningObjectives: string[];
  description: string;
  author: string;
  claimedBySPG?: string;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  initials: string;
  track: TrackType;
  tier: "Beginner" | "Advanced Member" | "Core Team";
  points: number;
  spgCount: number;
  articlesCount: number;
  eventWinsCount: number;
}

export const INITIAL_USER: UserProfile = {
  id: "usr-01",
  name: "Julian Chen",
  initials: "JC",
  email: "julian.c@reinforce.edu",
  track: "Research",
  tier: "Advanced Member",
  points: 240,
  reputation: 840,
  bio: "Research enthusiast focused on Deep Learning and Seismic Prediction. Currently leading the Kaggle Track SPG-2024-089 with a focus on graph neural networks.",
  location: "Tech Wing, Lab 4",
  joinedDate: "Joined Aug 2023",
  skills: [
    "PyTorch",
    "Graph Neural Networks",
    "Data Preprocessing",
    "Seismic Modeling",
    "CUDA Optimization",
    "Python",
    "AWS SageMaker",
    "LaTeX"
  ],
  links: {
    github: "https://github.com/Reinforce-SST",
    kaggle: "https://kaggle.com",
    discord: "Julian#8892",
    portfolio: "https://reinforce-sst.org"
  },
  eventWins: [
    {
      id: "win-1",
      title: "Global AI Datathon 2023",
      placement: "1ST PLACE",
      track: "PRODUCT TRACK",
      date: "DEC 2023"
    },
    {
      id: "win-2",
      title: "Kaggle Seismic Challenge",
      placement: "TOP 1% GLOBAL RANKING",
      track: "KAGGLE TRACK",
      date: "OCT 2023"
    },
    {
      id: "win-3",
      title: "24-Hour AI Sprint",
      placement: "HONORABLE MENTION",
      track: "RESEARCH TRACK",
      date: "AUG 2024"
    }
  ],
  verifiedSubmissions: [
    {
      id: "sub-1",
      title: "Deep Learning for Seismic Prediction – Weekly Report #08",
      timestamp: "2 hours ago",
      spgId: "SPG-2024-089"
    },
    {
      id: "sub-2",
      title: "Seismic Prediction Milestone 2: Architecture Finalization",
      timestamp: "Oct 15, 2024",
      spgId: "SPG-2024-089"
    },
    {
      id: "sub-3",
      title: "Deep Learning for Seismic Prediction – Weekly Report #07",
      timestamp: "Oct 08, 2024",
      spgId: "SPG-2024-089"
    }
  ]
};

export const INITIAL_SPGS: SPGProject[] = [
  {
    id: "SPG-2024-089",
    title: "Deep Learning for Seismic Prediction",
    track: "Kaggle",
    health: "on_track",
    progress: 65,
    description: "Developing an ensemble model for high-precision earthquake detection and early warning systems.",
    leadMember: "Julian Chen",
    leadEmail: "julian.c@reinforce.edu",
    nextDeadline: "24 Oct 2024",
    lastActivity: "2 hours ago",
    members: [
      { name: "Julian Chen", role: "LEADER • RESEARCH LEAD", initials: "JC" },
      { name: "Amara Kojo", role: "KAGGLE MASTER", initials: "AK" },
      { name: "Ryan Miller", role: "DATA ENGINEER", initials: "RM" }
    ],
    latestReport: {
      period: "Oct 17 - Oct 24, 2024",
      milestones: [
        "Finalized dataset cleaning and augmentation (Kaggle Hub)",
        "Trained baseline LSTM model with 88% accuracy"
      ],
      blockers: "Insufficient GPU credits for full ensemble training",
      nextSteps: "Implement Transformer-based spatial encoder and benchmark against baseline"
    },
    resourceRequests: [
      {
        id: "res-1",
        name: "NVIDIA A100 GPU Instance",
        detail: "48 Hours Cluster Access",
        status: "pending_review",
        allocationId: "--"
      },
      {
        id: "res-2",
        name: "AWS SageMaker Credits",
        detail: "$200 Budget Allocation",
        status: "approved",
        allocationId: "RSC-AWS-9021"
      }
    ],
    timeline: [
      { title: "Project Approved", date: "AUG 12, 2024", completed: true },
      { title: "Phase 1 Completion", date: "OCT 15, 2024", completed: true },
      { title: "Model Benchmark & Ensemble", date: "NOV 10, 2024", completed: false },
      { title: "Estimated Handover", date: "DEC 20, 2024", completed: false }
    ],
    reports: [
      {
        id: "rep-8",
        period: "Oct 17 - Oct 24, 2024",
        submittedAt: "Oct 24, 2024",
        summary: "Finalized pre-processing pipeline and trained first iteration baseline.",
        milestones: ["Pre-processing pipeline deployed", "Baseline LSTM 88% accuracy"],
        blockers: "A100 GPU queue pending review",
        nextSteps: "Transformer spatial encoder integration",
        approved: true
      }
    ]
  },
  {
    id: "SPG-2024-042",
    title: "Ethical Alignment in LLMs",
    track: "Research",
    health: "at_risk",
    progress: 22,
    description: "Quantitative analysis of reinforcement learning with human feedback (RLHF) across diverse cultures.",
    leadMember: "Sarah Miller",
    leadEmail: "sarah.m@reinforce.edu",
    nextDeadline: "30 Oct 2024",
    lastActivity: "12 Days Ago",
    members: [
      { name: "Sarah Miller", role: "LEADER • RESEARCH TRACK", initials: "SM" },
      { name: "Dev Patel", role: "ETHICS ANALYST", initials: "DP" }
    ],
    latestReport: {
      period: "Oct 01 - Oct 08, 2024",
      milestones: ["Curated cross-cultural question prompt benchmarks"],
      blockers: "Annotator bias calibration delays and missing weekly checkin",
      nextSteps: "Conduct round 2 calibration and finalize scoring framework"
    },
    resourceRequests: [
      {
        id: "res-3",
        name: "Crowdsourced Annotation Credits",
        detail: "1,000 Pairwise Evaluations",
        status: "pending_review",
        allocationId: "--"
      }
    ],
    timeline: [
      { title: "Proposal Approved", date: "SEP 01, 2024", completed: true },
      { title: "Data Collection Phase", date: "OCT 15, 2024", completed: false },
      { title: "Paper Draft for RE:Thesis", date: "DEC 01, 2024", completed: false }
    ],
    reports: []
  },
  {
    id: "SPG-2024-112",
    title: "Nexus AI Workflow Automator",
    track: "Product",
    health: "need_progress",
    progress: 88,
    description: "A multi-agent workflow system designed for automating academic scheduling and student resource discovery.",
    leadMember: "Kevin Wang",
    leadEmail: "kevin.w@reinforce.edu",
    nextDeadline: "18 Nov 2024",
    lastActivity: "Yesterday",
    members: [
      { name: "Kevin Wang", role: "PRODUCT LEAD", initials: "KW" },
      { name: "Elena Rostova", role: "FULL STACK DEV", initials: "ER" }
    ],
    latestReport: {
      period: "Oct 10 - Oct 17, 2024",
      milestones: ["Beta testing launched with 40 SST students", "Real-time calendar sync working"],
      blockers: "Need Render production tier upgrade for agent worker queues",
      nextSteps: "Prepare demo for Year-End Exhibition showcase"
    },
    resourceRequests: [
      {
        id: "res-4",
        name: "Render Dedicated Worker",
        detail: "Standard Instance $15/mo",
        status: "approved",
        allocationId: "RSC-RND-1044"
      }
    ],
    timeline: [
      { title: "Alpha Prototype", date: "JUL 20, 2024", completed: true },
      { title: "Beta Testing", date: "OCT 10, 2024", completed: true },
      { title: "Campus-Wide Rollout", date: "NOV 25, 2024", completed: false }
    ],
    reports: []
  },
  {
    id: "SPG-2024-055",
    title: "Autonomous Drone Visual Navigation",
    track: "Research",
    health: "on_track",
    progress: 54,
    description: "Reinforcement learning for optical flow-based indoor drone collision avoidance.",
    leadMember: "Priya Sharma",
    leadEmail: "priya.s@reinforce.edu",
    nextDeadline: "05 Nov 2024",
    lastActivity: "3 Days Ago",
    members: [
      { name: "Priya Sharma", role: "PROJECT LEAD", initials: "PS" },
      { name: "Anand Verma", role: "SIMULATION ENGINEER", initials: "AV" }
    ],
    latestReport: {
      period: "Oct 12 - Oct 19, 2024",
      milestones: ["AirSim simulator environment built", "PPO agent trained 50k episodes"],
      blockers: "Sim2Real transfer latency",
      nextSteps: "Test on physical DJI Tello in Lab 4"
    },
    resourceRequests: [
      {
        id: "res-5",
        name: "DJI Tello Testing Unit",
        detail: "Hardware Lab Access",
        status: "approved",
        allocationId: "HW-DRN-002"
      }
    ],
    timeline: [
      { title: "Simulation Benchmark", date: "SEP 15, 2024", completed: true },
      { title: "Lab Flight Trials", date: "NOV 15, 2024", completed: false }
    ],
    reports: []
  }
];

export const INITIAL_TICKETS: TicketItem[] = [
  {
    id: "#TK-8842",
    title: "GPU Cluster Access for SPG-2024-089",
    category: "resource_request",
    categoryLabel: "RESOURCE REQUEST",
    status: "in_progress",
    priority: "high",
    track: "Kaggle",
    createdAt: "2024-10-12T14:30:00Z",
    createdRelative: "2 hours ago",
    author: "Julian Chen",
    description: "Requesting 48 hours continuous A100 GPU cluster access for final spatial encoder ensemble training."
  },
  {
    id: "#TK-8839",
    title: "New SPG Registration: ReinforceBot",
    category: "spg_registration",
    categoryLabel: "REGISTRATION",
    status: "pending_approval",
    priority: "medium",
    track: "Product",
    createdAt: "2024-10-11T09:15:00Z",
    createdRelative: "Yesterday",
    author: "Kevin Wang",
    description: "Registering a new multi-track SPG to build discord automation and ticket queue helpers."
  },
  {
    id: "#TK-8790",
    title: "Misconduct Report: Discord Channel Spam",
    category: "misconduct",
    categoryLabel: "REPORT",
    status: "resolved",
    priority: "high",
    track: "General",
    createdAt: "2024-10-08T18:00:00Z",
    createdRelative: "4 days ago",
    author: "Anonymous Club Member",
    description: "Spam bot advertising non-club crypto servers in #general-discussion."
  },
  {
    id: "#TK-8722",
    title: "Mentorship Request for LLM Fine-tuning",
    category: "support_inquiry",
    categoryLabel: "SUPPORT INQUIRY",
    status: "in_progress",
    priority: "low",
    track: "Research",
    createdAt: "2024-10-05T11:20:00Z",
    createdRelative: "Last week",
    author: "Dev Patel",
    description: "Seeking advice on LoRA rank selection vs Full Fine-tuning for cultural dataset calibration."
  },
  {
    id: "#TK-8650",
    title: "Idea Jar Pick-up Approval: Graph Neural Seismic",
    category: "feedback",
    categoryLabel: "IDEA JAR",
    status: "resolved",
    priority: "medium",
    track: "Kaggle",
    createdAt: "2024-09-28T16:00:00Z",
    createdRelative: "2 weeks ago",
    author: "Julian Chen"
  }
];

export const INITIAL_EVENTS: ClubEvent[] = [
  {
    id: "evt-1",
    title: "Reinforce HackSprint v3.0",
    category: "Hackathon",
    date: "Sep 10, 2025",
    dayNumber: 10,
    monthDay: { month: "SEP", day: "10" },
    time: "18:00 IST",
    location: "Guild Main Lab",
    track: "Product",
    description: "Guild-wide rapid prototyping hackathon focusing on autonomous agents and AI tooling.",
    rsvpCount: 84,
    userRsvp: true,
    statusLabel: "REGISTERED",
    statusType: "registered"
  },
  {
    id: "evt-2",
    title: "Multi-Agent RL Advanced Deep Dive",
    category: "Workshop",
    date: "Sep 12, 2025",
    dayNumber: 12,
    monthDay: { month: "SEP", day: "12" },
    time: "10:30 IST",
    location: "Virtual • Discord",
    track: "Research",
    description: "Practical session on training cooperative multi-agent systems with MAPPO and QMIX algorithms.",
    rsvpCount: 38,
    userRsvp: false,
    statusLabel: "12 SLOTS LEFT",
    statusType: "available"
  },
  {
    id: "evt-3",
    title: "Founders Weekly Office Hours",
    category: "Meetup",
    date: "Sep 15, 2025",
    dayNumber: 15,
    monthDay: { month: "SEP", day: "15" },
    time: "16:00 IST",
    location: "Building C, Room 402",
    track: "Product",
    description: "Direct mentorship, pitch refinement, and technical advisory for active student SPG leads.",
    rsvpCount: 22,
    userRsvp: false,
    statusLabel: "AVAILABLE",
    statusType: "available"
  },
  {
    id: "evt-4",
    title: "Kaggle Grandmaster Fireside Chat",
    category: "Hackathon",
    date: "Sep 18, 2025",
    dayNumber: 18,
    monthDay: { month: "SEP", day: "18" },
    time: "20:00 IST",
    location: "Discord Stage",
    track: "Kaggle",
    description: "Live Q&A covering feature engineering tricks, cross-validation discipline, and ensemble stacking.",
    rsvpCount: 140,
    userRsvp: false,
    statusLabel: "LIMITED",
    statusType: "limited"
  },
  {
    id: "evt-5",
    title: "Deploying LLMs with vLLM & Triton",
    category: "Workshop",
    date: "Sep 21, 2025",
    dayNumber: 21,
    monthDay: { month: "SEP", day: "21" },
    time: "09:00 IST",
    location: "Guild Lab A",
    track: "Research",
    description: "Hands-on engineering workshop on continuous batching, PagedAttention, and custom Triton kernels.",
    rsvpCount: 50,
    userRsvp: false,
    statusLabel: "FULL",
    statusType: "full"
  }
];

export const INITIAL_ARTICLES: ArticleItem[] = [
  {
    id: "art-1",
    title: "Comparative Analysis of GNN vs LSTM in Seismic Early Warning",
    excerpt: "Benchmarking message passing neural networks against recurrent baselines on real-time Japanese seismograph signals.",
    author: "Julian Chen",
    authorTrack: "Research",
    publishDate: "Oct 12, 2024",
    views: "1.2K views",
    readTime: "8 min read",
    tags: ["Deep Learning", "GNN", "Seismic", "PyTorch"],
    peerReviewed: true,
    isPaper: true
  },
  {
    id: "art-2",
    title: "Optimizing Batch Processing for High-Frequency Sensor Data",
    excerpt: "How we reduced data ingestion bottlenecks by 4.2x using custom CUDA kernels and shared GPU memory streams.",
    author: "Julian Chen",
    authorTrack: "Research",
    publishDate: "Sept 28, 2024",
    views: "840 views",
    readTime: "5 min read",
    tags: ["CUDA", "Optimization", "High-Performance Computing"],
    peerReviewed: true,
    isPaper: false
  },
  {
    id: "art-3",
    title: "Building LLM Multi-Agent Frameworks from Scratch",
    excerpt: "Lessons learned building an autonomous academic scheduling assistant without heavy framework bloat.",
    author: "Kevin Wang",
    authorTrack: "Product",
    publishDate: "Oct 04, 2024",
    views: "1.5K views",
    readTime: "6 min read",
    tags: ["Agents", "LLM", "Product"],
    peerReviewed: false,
    isPaper: false
  }
];

export const INITIAL_IDEAS: IdeaItem[] = [
  {
    id: "idea-1",
    title: "Diffusion-Based Audio Denoising for Campus Lectures",
    track: "Research",
    difficulty: "Intermediate",
    skillsRequired: ["PyTorch", "Diffusion Models", "Signal Processing", "Librosa"],
    learningObjectives: [
      "Understand score-based generative modeling for 1D spectrograms",
      "Deploy real-time streaming audio pipeline"
    ],
    description: "Create a lightweight generative model capable of eliminating lecture hall reverb and microphone hum without distorting voice clarity.",
    author: "Reinforce Core"
  },
  {
    id: "idea-2",
    title: "Autonomous Kaggle Tabular AutoML Pipeline",
    track: "Kaggle",
    difficulty: "Advanced",
    skillsRequired: ["LightGBM", "CatBoost", "Optuna", "Feature Engineering"],
    learningObjectives: [
      "Build generic feature generation for Kaggle competition datasets",
      "Automated stacking & ensemble blender"
    ],
    description: "An automated pipeline that ingests tabular datasets, extracts temporal and interaction features, and optimizes an ensemble of tree-based models.",
    author: "Reinforce Core"
  },
  {
    id: "idea-3",
    title: "SST Campus AI Concierge & Lost-and-Found Vision Bot",
    track: "Product",
    difficulty: "Beginner",
    skillsRequired: ["Next.js", "OpenAI Vision API / CLIP", "FastAPI", "Postgres"],
    learningObjectives: [
      "Vector embeddings with image search",
      "Building a friendly student web tool with Discord integration"
    ],
    description: "Students take a photo of a lost item, and vector search matches it against logged items found by security.",
    author: "Sarah Varghese"
  }
];

export const INITIAL_LEADERBOARD: LeaderboardEntry[] = [
  {
    rank: 1,
    name: "Julian Chen",
    initials: "JC",
    track: "Research",
    tier: "Advanced Member",
    points: 240,
    spgCount: 2,
    articlesCount: 5,
    eventWinsCount: 3
  },
  {
    rank: 2,
    name: "Sarah Varghese",
    initials: "SV",
    track: "Kaggle",
    tier: "Core Team",
    points: 220,
    spgCount: 3,
    articlesCount: 4,
    eventWinsCount: 4
  },
  {
    rank: 3,
    name: "Kevin Wang",
    initials: "KW",
    track: "Product",
    tier: "Advanced Member",
    points: 195,
    spgCount: 2,
    articlesCount: 3,
    eventWinsCount: 2
  },
  {
    rank: 4,
    name: "Amara Kojo",
    initials: "AK",
    track: "Kaggle",
    tier: "Advanced Member",
    points: 180,
    spgCount: 1,
    articlesCount: 2,
    eventWinsCount: 2
  },
  {
    rank: 5,
    name: "Elena Rostova",
    initials: "ER",
    track: "Product",
    tier: "Beginner",
    points: 130,
    spgCount: 1,
    articlesCount: 1,
    eventWinsCount: 1
  },
  {
    rank: 6,
    name: "Priya Sharma",
    initials: "PS",
    track: "Research",
    tier: "Beginner",
    points: 110,
    spgCount: 1,
    articlesCount: 1,
    eventWinsCount: 0
  }
];
