const fs = require("fs");
const categoryName = "animals";
console.log(categoryName);

fs.readFile("data.json", "utf8", (err, data) => {
    if (err) {
        console.error(err);
        return;
    }

    const jsonData = JSON.parse(data);

    

    let updated = jsonData[categoryName].map(item => ({
        // char: item.char, word: item.word, wordMeaning: item.wordMeaning, emoji: item.emoji, color: item.color                
        // char: item.char, word: item.wordMeaning, wordMeaning: item.word, emoji: item.emoji, color: item.color
        
        char: item.char.split('')[0].toUpperCase(), word: item.word, wordMeaning: item.wordMeaning, emoji: item.emoji, color: item.color
        // char: item.char.split('')[0].toLowerCase(), word: item.word, wordMeaning: item.wordMeaning, emoji: item.emoji, color: item.color
    }));

    let textToadd = ''
    for (let index = 0; index < updated.length; index++) {
        const element = updated[index];
        if (index == 0) {
            textToadd += `[\n ${JSON.stringify(element)},\n`
        } else if (index == (+updated.length - 1)) {
            textToadd += `${JSON.stringify(element)}\n]`
        } else {
            textToadd += `${JSON.stringify(element)},\n`
        }
    }


    fs.writeFileSync("test.json", textToadd, "utf8");
});
