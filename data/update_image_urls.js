const fs = require('fs');
const path = require('path');

// Old and new IPFS URLs
const oldUrl = "https://amaranth-casual-coral-990.mypinata.cloud/ipfs/bafybeifrsitbsahcpayscevma26znxunc5dzfdmn3hrhwl5utzte4viata";
const newUrl = "https://amaranth-casual-coral-990.mypinata.cloud/ipfs/bafybeid6zakrlaqu5rng2fljodlgg6rpvnc3p3hyuztqq2k67oyusun4fi";

// Counter for modified files
let modifiedCount = 0;

// Get all JSON files in the current directory
const jsonFiles = fs.readdirSync('.')
    .filter(file => file.endsWith('.json'));

console.log(`Found ${jsonFiles.length} JSON files to process...`);

jsonFiles.forEach(jsonFile => {
    try {
        // Read the JSON file
        const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
        
        // Check if any attribute has value "Community 1/1"
        const hasCommunity1_1 = data.attributes?.some(
            attr => attr.value === 'Community 1/1'
        );
        
        // If found, update the image URL
        if (hasCommunity1_1 && data.image) {
            if (data.image.includes(oldUrl)) {
                data.image = data.image.replace(oldUrl, newUrl);
                // Write the updated data back to the file
                fs.writeFileSync(jsonFile, JSON.stringify(data, null, 2));
                modifiedCount++;
                console.log(`Updated ${jsonFile}`);
            }
        }
    } catch (error) {
        console.error(`Error processing ${jsonFile}: ${error.message}`);
    }
});

console.log(`\nProcess completed. Modified ${modifiedCount} files.`); 