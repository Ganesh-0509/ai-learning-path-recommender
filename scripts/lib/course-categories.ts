/**
 * Deterministic category assignment for the 80 courses mined from the Round 1
 * dataset. This is a closed classification of *known* course
 * titles — not a judgment call worth spending a local-LLM call on — so it's
 * a plain lookup table, kept separate from the LLM-driven level/description/
 * skills pass in scripts/generate-course-catalog.ts.
 *
 * Grouping courses by category is what lets the prerequisite graph be built
 * deterministically (docs/TRD.md §4.2): within a category, a lower-level
 * course becomes the prerequisite of a higher-level one.
 */
export const CATEGORY_MAP: Record<string, string> = {
  'C Plus Plus Programming Essentials': 'Programming Fundamentals',
  'Java Programming Basics': 'Programming Fundamentals',
  'JavaScript Fundamentals': 'Programming Fundamentals',
  'Python for Absolute Beginners': 'Programming Fundamentals',
  'Python OOP Concepts': 'Programming Fundamentals',
  'Python Programming Masterclass': 'Programming Fundamentals',
  'Go Language for Backend': 'Programming Fundamentals',
  'HTML and CSS for Beginners': 'Programming Fundamentals',
  'Linux Command Line Essentials': 'Programming Fundamentals',
  'Git and GitHub Mastery': 'Programming Fundamentals',
  'TypeScript for Developers': 'Programming Fundamentals',
  'Modern JavaScript ES6 Plus': 'Programming Fundamentals',
  'Python Automation and Scripting': 'Programming Fundamentals',
  'Advanced Python Development': 'Programming Fundamentals',
  'Embedded Systems Programming': 'Programming Fundamentals',

  'React.js Development': 'Web Development',
  'Angular Framework Essentials': 'Web Development',
  'Vue.js for Beginners': 'Web Development',
  'Responsive Web Design': 'Web Development',
  'Django Web Framework': 'Web Development',
  'Flask API Development': 'Web Development',
  'Node.js Backend Development': 'Web Development',
  'JavaScript Full Stack Development': 'Web Development',
  'REST API Design Principles': 'Web Development',
  'GraphQL API Development': 'Web Development',
  'Advanced Java and Spring Boot': 'Web Development',

  'Android App Development': 'Mobile Development',
  'iOS App Development with Swift': 'Mobile Development',
  'Flutter Cross Platform Apps': 'Mobile Development',
  'React Native Mobile Development': 'Mobile Development',

  'Data Analysis with Pandas': 'Data Analytics',
  'Data Visualization with Matplotlib': 'Data Analytics',
  'Excel for Data Analysis': 'Data Analytics',
  'Exploratory Data Analysis': 'Data Analytics',
  'Power BI Dashboard Creation': 'Data Analytics',
  'Tableau for Business Analytics': 'Data Analytics',
  'Statistical Analysis with R': 'Data Analytics',
  'Python for Data Science': 'Data Analytics',

  'Machine Learning Fundamentals': 'Machine Learning & AI',
  'Deep Learning with TensorFlow': 'Machine Learning & AI',
  'Deep Learning with PyTorch': 'Machine Learning & AI',
  'Supervised Learning Algorithms': 'Machine Learning & AI',
  'Unsupervised Learning Techniques': 'Machine Learning & AI',
  'Reinforcement Learning Basics': 'Machine Learning & AI',
  'Natural Language Processing': 'Machine Learning & AI',
  'Computer Vision with OpenCV': 'Machine Learning & AI',
  'Advanced Neural Networks': 'Machine Learning & AI',
  'Transfer Learning and Fine-tuning': 'Machine Learning & AI',
  'Feature Engineering for ML': 'Machine Learning & AI',
  'Generative AI and Prompt Engineering': 'Machine Learning & AI',
  'MLOps and Model Deployment': 'Machine Learning & AI',

  'Linear Algebra for Machine Learning': 'Math & Statistics',
  'Calculus for Data Science': 'Math & Statistics',
  'Probability and Statistics': 'Math & Statistics',
  'Bayesian Statistics': 'Math & Statistics',
  'Hypothesis Testing in Practice': 'Math & Statistics',
  'Time Series Analysis': 'Math & Statistics',

  'SQL for Beginners': 'Databases',
  'Advanced SQL and Query Optimization': 'Databases',
  'PostgreSQL Database Design': 'Databases',
  'MongoDB for Developers': 'Databases',
  'Database Performance Tuning': 'Databases',
  'Redis Caching Strategies': 'Databases',
  'Data Warehouse Design': 'Databases',

  'ETL Pipeline Development': 'Data Engineering',
  'Data Engineering with Apache Spark': 'Data Engineering',
  'Apache Kafka for Real-time Data': 'Data Engineering',

  'AWS Cloud Practitioner': 'Cloud Computing',
  'AWS Solutions Architect': 'Cloud Computing',
  'Azure Fundamentals': 'Cloud Computing',
  'Google Cloud Platform Basics': 'Cloud Computing',

  'Docker and Containerization': 'DevOps',
  'Kubernetes Orchestration': 'DevOps',
  'CI CD Pipeline Setup': 'DevOps',
  'DevOps Practices and Tools': 'DevOps',

  'Cybersecurity Fundamentals': 'Cybersecurity',
  'Ethical Hacking Basics': 'Cybersecurity',

  'Blockchain Development': 'Blockchain',
  'Smart Contract Programming with Solidity': 'Blockchain',

  'IoT with Raspberry Pi': 'IoT',
};

export function categoryFor(courseTitle: string): string {
  const category = CATEGORY_MAP[courseTitle];
  if (!category) {
    throw new Error(
      `No category mapped for course "${courseTitle}" — add it to CATEGORY_MAP.`,
    );
  }
  return category;
}
