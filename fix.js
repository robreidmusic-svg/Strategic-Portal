const fs = require('fs');
const path = './src/services/ai/marketResearch.ts';
let code = fs.readFileSync(path, 'utf8');

// Fix types
code = code.replace(/type: "OBJECT"/g, 'type: "object"');
code = code.replace(/type: "STRING"/g, 'type: "string"');
code = code.replace(/type: "ARRAY"/g, 'type: "array"');

// Fix JSON.parse
code = code.replace(/JSON\.parse\(response\.text \|\| '(\{.*?\})'\)/g, `JSON.parse((response.text || '$1').replace(/^\\s*\`\`\`(?:json)?\\n?/, '').replace(/\\n?\`\`\`\\s*$/, '').trim() || '$1')`);

fs.writeFileSync(path, code);
