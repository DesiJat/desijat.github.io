const monthNames = [
  "-",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const resumeData = {
  title: "SandeepKumar_Resume",
  name: "Sandeep Kumar",
  designation: "Senior Software Engineer",
  contact: {
    email: '<a href="mailto:ladwapanghal@gmail.com">ladwapanghal@gmail.com</a>',
    phone: '<a href="tel:+918685004675">+918685004675</a>',
    linkedin: '<a href="https://www.linkedin.com/in/sandeepchoudhari/" target="_blank">linkedin.com/in/sandeepchoudhari</a>',
    address: 'Mohali, Punjab, India'
  },
  summary: "Senior Software Engineer with 9+ years of experience architecting and developing scalable SaaS, FinTech, and Web3 platforms. Specialized in building distributed multi-tenant systems, event-driven microservices, and real-time architectures using Node.js, NestJS, and TypeScript. Extensive expertise spanning full-stack engineering (React, GraphQL), cloud infrastructure (AWS EC2, S3, Docker, Terraform), and high-performance databases (PostgreSQL, Redis). Proven track record in emerging technologies, including Web3 integrations (Ethereum, EVM/UTXO chains, Fireblocks, Smart Contracts) and AI/LLM automation (Ollama, GGUF models, Google Gemini), driving enterprise-scale production environments.",
  experience: [
    {
      title: "Senior Software Engineer",
      company: "Antier Solutions (Mohali, Punjab, India)",
      dates: "January 2021 - Present",
      details: [
        "Designed and developed scalable backend systems using Node.js, TypeScript, NestJS, and microservices architecture.",
        "Built and maintained Web3-based FinTech applications integrating Ethereum, Bitcoin, Ripple, Cardano, and other cryptocurrencies.",
        "Implemented real-time communication systems using Socket.IO for high-concurrency applications.",
        "Designed event-driven architecture using RabbitMQ for distributed systems.",
        "Integrated LLM and AI-based features using Ollama for intelligent automation workflows.",
        "Containerized and deployed services using Docker for consistent production environments.",
        "Implemented Redis caching strategies improving API response time and system performance.",
        "Collaborated with cross-functional teams to deliver enterprise SaaS platforms."
      ],
    },
    {
      title: "Software Engineer",
      company: "Dabster SoftTech (Mohali, Punjab, India)",
      dates: "May 2018 - January 2021",
      details: [
        "Developed scalable applications using Laravel, Node.js, React, and Angular.",
        "Integrated secure payment gateways including Stripe and PayPal for FinTech systems.",
        "Implemented push notifications and real-time systems using Socket.IO.",
        "Optimized database performance in MySQL and MongoDB environments.",
        "Enhanced application reliability using Redis caching and queue systems."
      ],
    },
    {
      title: "Web Developer",
      company: "Webmob Information Systems Pvt Ltd (Chandigarh, India)",
      dates: "March 2016 - May 2018",
      details: [
        "Developed and maintained backend services using Laravel and Node.js.",
        "Built REST APIs and managed MySQL databases.",
        "Improved application performance and user experience across multiple client projects."
      ],
    },
    {
      title: "Web Developer",
      company: "CS Soft Solutions Pvt. Ltd. (Mohali, Punjab, India)",
      dates: "August 2015 - January 2016",
      details: [
        "Developed PHP-based applications using CodeIgniter and Laravel.",
        "Designed and maintained MySQL database structures.",
        "Implemented new features and optimized legacy codebases."
      ],
    },
  ],
  education: [
    {
      degree: "Master of Computer Applications (MCA-5 year integrated), First Division",
      institution: "Guru Jambheshwar University of Science and Technology, Hisar, Haryana",
      dates: "2009 - 2014",
    },
  ],
  skillCategories: [
    {
      name: "Backend",
      skills: ["Node.js", "NestJS", "Express.js", "gRPC", "GraphQL", "Laravel"]
    },
    {
      name: "Frontend",
      skills: ["React.js", "Electron", "Vite"]
    },
    {
      name: "Architecture & DevOps",
      skills: ["AWS (EC2, S3, KMS)", "Microservices", "Event-Driven Architecture", "REST APIs", "Docker", "Docker Compose", "Terraform", "CI/CD"]
    },
    {
      name: "Databases & Storage",
      skills: ["PostgreSQL", "MySQL", "MongoDB", "Redis"]
    },
    {
      name: "Messaging & Real-time",
      skills: ["RabbitMQ", "Kafka", "Socket.IO", "Redis Pub/Sub"]
    },
    {
      name: "Web3",
      skills: ["Ethereum", "Bitcoin", "XRP", "Fireblocks", "RWA", "ERC20", "NFT", "EVM-based Chains", "UTXO-based Chains", "Solidity Smart Contracts"]
    },
    {
      name: "AI",
      skills: ["LLM Integrations", "Ollama", "GGUF models", "Google Gemini API"]
    },
    {
      name: "Tools & Libraries",
      skills: ["Git", "Jira", "Stripe", "PayPal", "Swagger", "JWT", "TypeORM", "BullMQ", "Passport.js", "MinIO"]
    },
    {
      name: "Languages",
      skills: ["TypeScript", "JavaScript", "PHP"]
    }
  ],
  projects: [
    {
      name: "SaaS Infrastructure & Deployment Management Platform",
      desc: "Engineered a scalable SaaS platform with dynamic deployment capabilities, automating environment provisioning through Terraform service integration. Implemented an event-driven architecture to manage system life-cycles and trigger contextual SMTP notifications based on real-time deployment and health status. Built robust dashboards for license monitoring and subscription management.",
      technology: ["Node.js", "TypeScript", "Event-Driven Architecture", "SMTP", "MongoDB", "Stripe"],
    },
    {
      name: "FinTech & Crypto Platforms",
      desc: "Integrated BTC, BCH, ETH, XRP, ADA, LTC wallets and blockchain APIs. Implemented secure transaction handling and payment workflows. Built microservices architecture for high availability.",
      technology: ["Node.js", "NestJS", "Web3", "Blockchain APIs", "Microservices"],
    },
    {
      name: "Scalable Real-Time Chat & Communication Platform",
      desc: "Engineered a high-concurrency real-time chat system supporting private and group messaging. Implemented features like message delivery receipts, typing indicators, and online presence tracking. Optimized performance using Redis for session management and Socket.IO for low-latency communication.",
      technology: ["Node.js", "Socket.IO", "Redis", "MySQL", "Express.js"],
    },
    {
      name: "AI-Powered Automation & Multi-Purpose Chatbot Platform",
      desc: "Developed a comprehensive AI platform featuring a Node.js backend and a modern frontend for deploying automated chatbots across diverse domains. Integrated local LLMs via Ollama and GGUF models for data privacy, alongside third-party APIs like Google Gemini for advanced reasoning. Scaled intelligent workflows for automated customer support, document analysis, and task automation.",
      technology: ["Node.js", "Express.js", "Ollama", "GGUF models", "Google Gemini API", "LLMs"],
    },
    {
      name: "Enterprise Multi-Tenant Employee Monitoring & Project Management Platform",
      desc: "Engineered a full-scale SaaS platform with a NestJS microservices backend (10 services) and an Electron + React desktop agent for cross-platform employee activity tracking. Implemented a 3-tier RBAC system (L1/L2/L3) with JWT authentication, multi-tenant isolation across 7 dedicated PostgreSQL databases, and real-time updates via Socket.IO scaled horizontally with Redis Pub/Sub Adapter. Delivered automated screenshot capture, keyboard/mouse activity logging, offline queue with sync, BullMQ background job processing, and MinIO-based file storage — all containerized with Docker Compose.",
      technology: [
        "NestJS", "TypeScript", "Electron", "React", "Vite",
        "PostgreSQL", "TypeORM", "Redis", "BullMQ",
        "Socket.IO", "MinIO", "Nodemailer", "Passport.js",
        "JWT", "Docker", "Docker Compose", "Swagger"
      ],
    }

  ]
};
