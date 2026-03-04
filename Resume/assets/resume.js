document.addEventListener("DOMContentLoaded", function () {
  // Update header info
  document.getElementById("name").textContent = resumeData.name;
  document.getElementById("designation").textContent = resumeData.designation;

  const contactContainer = document.getElementById("contact");
  const contactInfo = [
    resumeData.contact.email,
    resumeData.contact.phone,
    resumeData.contact.linkedin,
    // resumeData.contact.address
  ];
  contactContainer.innerHTML = contactInfo.join(' | ');

  // Update summary
  document.getElementById("summary").textContent = resumeData.summary;

  // Render Skill Categories
  const skillsContainer = document.getElementById("skills-container");
  resumeData.skillCategories.forEach(category => {
    const categoryDiv = document.createElement("div");
    categoryDiv.className = "skill-category";

    const h3 = document.createElement("h3");
    h3.textContent = category.name;
    categoryDiv.appendChild(h3);

    const tagsDiv = document.createElement("div");
    tagsDiv.className = "skill-tags";

    category.skills.forEach(skill => {
      const span = document.createElement("span");
      span.className = "skill-tag";
      span.textContent = skill;
      tagsDiv.appendChild(span);
    });

    categoryDiv.appendChild(tagsDiv);
    skillsContainer.appendChild(categoryDiv);
  });

  // Render Experience
  const experienceSection = document.getElementById("experience");
  experienceSection.innerHTML = resumeData.experience.map(job => `
    <div class="job">
      <div class="job-header">
        <div>
          <span class="job-title">${job.title}</span>
          <br>
          <span class="job-company">${job.company}</span>
        </div>
        <span class="job-date">${job.dates}</span>
      </div>
      <ul>
        ${job.details.map(detail => `<li>${detail}</li>`).join('')}
      </ul>
    </div>
  `).join('');

  // Render Education
  const educationSection = document.getElementById("education");
  educationSection.innerHTML = resumeData.education.map(edu => `
    <div class="education">
      <div class="edu-header">
        <span class="edu-degree">${edu.degree}</span>
        <span class="edu-date">${edu.dates}</span>
      </div>
      <div class="edu-inst">${edu.institution}</div>
    </div>
  `).join('');

  // Render Projects
  const projectsSection = document.getElementById("projects");
  projectsSection.innerHTML = resumeData.projects.map(project => `
    <div class="project">
      <div class="project-header">
        <span class="project-name">${project.name}</span>
      </div>
      <p class="project-desc">${project.desc}</p>
      <div class="project-tech">
        ${project.technology.map(tech => `<span class="tech-tag">${tech}</span>`).join('')}
      </div>
    </div>
  `).join('');
});
