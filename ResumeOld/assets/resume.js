document.addEventListener("DOMContentLoaded", function () {
  // Concatenate contact details into a single string
  // const contactDetails = Object.values(resumeData.contact).join(' | ');
  const contactDetails = Object.keys(resumeData.contact)
    .map(
      (key) =>
        `${key.charAt(0).toUpperCase() + key.slice(1)}: ${resumeData.contact[key]
        }`
    )
    .join(" | ");
  // Concatenate skills and secondarySkills into single strings
  const skillsDetails = resumeData.skills.join("&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;");
  // const skillsDetails = resumeData.skills.join('</br>');
  const secondarySkillsDetails = resumeData.secondarySkills.join("&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;");
  // const secondarySkillsDetails = resumeData.secondarySkills.join('</br>');
  const title = resumeData.name + " " + resumeData.title;

  // document.getElementById("title").textContent = title;
  document.getElementById("title").textContent = resumeData.title;
  document.getElementById("name").innerHTML = resumeData.name;
  // document.getElementById("designation").innerHTML = '<b>'+resumeData.designation+'</b>';
  document.getElementById("summary").textContent = resumeData.summary;
  // Set the contact details as the inner HTML of the element with ID 'contact'
  document.getElementById("contact").innerHTML = contactDetails;

  // Set the skills as the inner HTML of the element with ID 'skills'
  // document.getElementById('skills').innerHTML = `<strong>Skills:</strong> ${skillsDetails}`;
  // document.getElementById('skills').innerHTML = `<h2>Skills:</h2> ${skillsDetails}`;
  document.getElementById("skills").innerHTML = skillsDetails;
  
  const slicedSkills = resumeData.skills.slice(0, 16);
  document.getElementById("sortSkill").innerHTML = '<b>'+slicedSkills.join(' | ')+'</b>';
  // Set the secondary skills as the inner HTML of the element with ID 'secondarySkills'
  // document.getElementById('secondarySkills').innerHTML = `<h2>Secondary Skills:</h2> ${secondarySkillsDetails}`;
  document.getElementById("secondarySkills").innerHTML = secondarySkillsDetails;

  // Get the experience section element
  const experienceSection = document.getElementById("experience");

  // Build the HTML string for all job experiences
  const experiencesHTML = resumeData.experience
    .map(
      (job) => `
  <div class="job">
    <h3>${job.title} at ${job.company}</h3>
    <p>${job.dates}</p>
    <ul>
      ${job.details.map((detail) => `<li>${detail}</li>`).join("")}
    </ul>
  </div>
`    )
    .join("");

  // Set the inner HTML of the experience section element in one go
  experienceSection.innerHTML = experiencesHTML;

  // Get the education section element
  const educationSection = document.getElementById("education");

  // Build the HTML string for all education entries
  const educationHTML = resumeData.education
    .map(
      (edu) => `
  <div class="education">
    <h3>${edu.degree}</h3>
    <p>${edu.institution} (${edu.dates})</p>
  </div>
`
    )
    .join("");

  // Set the inner HTML of the education section element in one go
  educationSection.innerHTML = educationHTML;

  
    const projectsSection = document.getElementById('projects');
    resumeData.projects.forEach(project => {
        const projectDiv = document.createElement('div');
        projectDiv.classList.add('project');
        let projestDetails=`</br><h3><u>${project.name}</h3></u>`;
        if(!!project.link){
          const linkArr=project.link.split(',');
          projestDetails += linkArr.map((lnk)=>`<a href="${lnk}" target="_blank">${lnk}</a>`).join("</br>");
          // projestDetails += `<p>link: <a href="${project.link}" target="_blank">${project.link}</a></p>`;  
        }
        
        projestDetails += `<p>${project.desc}</p>`;
        projestDetails += `<p><b>Technologies:</b> ${project.technology.map(tech => tech).join(' | ')}</p>`;
        // projestDetails += `<ul>${project.technology.map(tech => `<li>${tech}</li>`).join('')}</ul>`;

        projectDiv.innerHTML = projestDetails;
        projectsSection.appendChild(projectDiv);
    });
   
});
