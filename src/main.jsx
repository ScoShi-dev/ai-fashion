import React, { useState, useCallback, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, increment } from 'firebase/firestore';

// --- Helper Functions & Constants ---

const IMAGE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=`;
const TEXT_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=`;

// Helper for dynamic prompts
const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

const dynamicElements = {
  settings: ['in a bustling city street scene', 'against a minimalist studio background', 'in a neon-lit alleyway', 'in a serene, sun-dappled forest', 'in a chic, modern cafe'],
  lighting: ['with dramatic, high-contrast lighting', 'with soft, diffused natural light', 'with vibrant, colorful gel lighting', 'under the warm glow of sunset'],
  accessories: ['with statement sunglasses', 'wearing delicate gold jewelry', 'with a designer handbag', 'featuring a unique hat', 'with stylish leather gloves'],
};

const makePromptDynamic = (basePrompt) => {
    return `hyper-photorealistic, fashion editorial quality, sharp focus, ${basePrompt}, ${getRandomElement(dynamicElements.settings)}, ${getRandomElement(dynamicElements.lighting)}, ${getRandomElement(dynamicElements.accessories)}.`;
};


// Expanded and alphabetized list of fashion styles
const INITIAL_FASHION_STYLES = [
  { name: '50s Rockabilly', img: 'https://hiplatina.com/wp-content/uploads/sites/6/2020/02/Rockabilly-Style-1.jpg?fit=720,687&crop=0px,142px,720px,404px', prompt: 'A classic 1950s Rockabilly look with high-waisted jeans, a tied-up plaid shirt, and a bandana in the hair.' },
  { name: '60s Mod', img: 'https://vintagedancer.com/wp-content/uploads/1960s-A-line-dresses-1.jpg', prompt: 'A chic 1960s Mod outfit featuring a geometric print A-line mini dress, white go-go boots, and dramatic eyeliner.' },
  { name: '70s Disco', img: 'https://www.womansworld.com/wp-content/uploads/2024/07/70s-Fashion.png?quality=86&strip=all', prompt: 'A glamorous 1970s Disco ensemble with a sequined jumpsuit, platform heels, and big, voluminous hair.' },
  { name: '80s New Wave', img: 'https://writersblockmagazine.files.wordpress.com/2019/11/nw10-1.png?w=634', prompt: 'An edgy 1980s New Wave look with bold colors, shoulder pads, asymmetric haircut, and futuristic sunglasses.' },
  { name: '90s Grunge', img: 'https://hips.hearstapps.com/hmg-prod/images/grunge-aesthetic-1674662854.png?crop=0.6666666666666666xw:1xh;center,top&resize=1200:*', prompt: 'A 90s Grunge look with plaid flannel, ripped denim, a band t-shirt, and combat boots.' },
  { name: 'Y2K', img: 'https://wwd.com/wp-content/uploads/2023/11/Y2KTrends.jpg', prompt: 'A quintessential Y2K (2000s) outfit with low-rise jeans, a cropped baby tee, a denim jacket, and a butterfly clips in the hair.' },
  { name: '2010s Indie', img: 'https://www.clothestotheedge.uk/cdn/shop/articles/indie_vintage_e591994c-b5d7-4d72-9e4c-024c8f220a1e.jpg?v=1745667177&width=1100', prompt: 'A 2010s Indie/Hipster style with skinny jeans, a vintage-style graphic tee, a beanie, and large-framed glasses.' },
  { name: 'Academia', img: 'https://sweetmagnoliaa.com/wp-content/uploads/2024/05/DALL%C2%B7E-2024-05-28-09.44.38-A-subject-sitting-on-a-stone-amidst-ivy-covered-trees-wearing-a-patterned-cardigan-over-a-pinstripe-shirt-paired-with-corduroy-slacks-and-brogue-sho-1024x585.webp', prompt: 'A stylish Dark Academia outfit, featuring tweed, cardigans, and classic literature vibes.' },
  { name: 'Animal-core', img: 'https://upload.wikimedia.org/wikipedia/en/e/e7/Animal_%28Muppet%29.jpg', prompt: 'A high-fashion punk rock look inspired by Animal. The model should have wild, untamed hair in fiery reds and oranges. The makeup is dramatic, with heavy, smudged eyeliner. The outfit features a distressed, studded leather jacket, ripped band t-shirt, and tartan plaid pants. Accessories are key: layers of chains, spiked bracelets, and a drumstick prop. The pose should be energetic and chaotic, capturing a mid-motion rock-out moment.' },
  { name: 'Art Deco', img: 'https://images.squarespace-cdn.com/content/v1/56e36f751d07c0743d1e142f/1460315399856-KPL8GMONIJADKRNC37BL/Art+Deco+Leisure+Fashion%2C+Photographer%3A+Edward+Steichen', prompt: 'An elegant outfit inspired by 1920s Art Deco, with geometric patterns, gold accents, and luxurious fabrics.' },
  { name: 'Athleisure', img: 'https://www.technogym.com/wpress/wp-content/uploads/2018/03/wellness-1.jpg', prompt: 'A trendy athleisure outfit, blending sportswear with casual fashion.' },
  { name: 'Bert-core', img: 'https://sesameworkshop.org/wp-content/uploads/2023/03/presskit_ss_bio_bert.png', prompt: 'A quirky, intellectual, Wes Anderson-inspired look inspired by Bert. The model has impeccably neat, slightly tall hair and is wearing thick-framed glasses. The outfit consists of a bottle-green and orange vertically striped turtleneck under a sensible beige corduroy blazer and high-waisted trousers. Accessories include a collection of fountain pens in the pocket and a book on pigeons. The pose is stiff, slightly awkward, but endearing.' },
  { name: 'Big Bird-core', img: 'https://sesameworkshop.org/wp-content/uploads/2023/03/presskit_ss_bio_bigbird.png', prompt: 'An avant-garde high-fashion ensemble inspired by Big Bird. The model has a dramatic, high-volume blonde hairstyle with feathery wisps. Makeup is bright and sunny, with yellow and orange eyeshadow. The centerpiece is a cascading, floor-length coat made of bright yellow faux feathers, worn over a simple white sheath dress. Accessorize with long, striped orange and pink leggings and quirky, bird-like heels. The pose should be graceful and elongated, exuding a gentle and friendly yet high-fashion aura.' },
  { name: 'Bohemian', img: 'https://res.cloudinary.com/jerrick/image/upload/d_642250b563292b35f27461a7.png,f_jpg,fl_progressive,q_auto,w_1024/5f6873862b964a001ccfc80d.jpg', prompt: 'A free-spirited Bohemian look with flowing fabrics, earthy tones, and eclectic accessories.' },
  { name: 'Bridgerton', img: 'https://www.refinery29.com/images/11727782.jpg', prompt: 'A stunning Regency-era ballgown inspired by Bridgerton, with an empire waist, delicate embroidery, long gloves, and an elegant updo.' },
  { name: 'Business Casual', img: 'https://images.pexels.com/photos/837140/pexels-photo-837140.jpeg', prompt: 'A modern business casual outfit, perfect for a contemporary office.' },
  { name: 'Cookie Monster-core', img: 'https://sesameworkshop.org/wp-content/uploads/2023/03/presskit_ss_bio_cookiemonster.png', prompt: 'An avant-garde, deconstructed high-fashion look inspired by Cookie Monster. The outfit is a mix of textures: the exact Cookie Monster blue color, shaggy faux-fur, and wide-leg trousers. Accessories include a single, oversized, chunky \'cookie\' medallion necklace. The pose is dramatic and fashionable.' },
  { name: 'Cottagecore', img: 'https://www.glam.com/img/gallery/all-the-outfit-inspo-you-need-for-a-cottagecore-fall-2023/l-intro-1690905228.jpg', prompt: 'A romantic Cottagecore outfit with floral prints, puff sleeves, and a rustic, countryside feel.' },
  { name: 'Cyberpunk', img: 'https://techwearstorm.com/cdn/shop/files/cyberpunk-aesthetic-techwearstorm-1.webp', prompt: 'A futuristic Cyberpunk outfit with neon accents, tech-wear elements, and a dystopian edge.' },
  { name: 'Elmo-core', img: 'https://sesameworkshop.org/wp-content/uploads/2023/03/presskit_ss_bio_elmo.png', prompt: 'A chic and playful monochrome street style look inspired by Elmo. The model has vibrant red hair styled in a cute, bouncy bob. The outfit is a head-to-toe bright red ensemble: a fuzzy, cropped sweater, high-waisted red vinyl pants, and matching platform heels. The pose is bubbly and full of infectious energy.' },
  { name: 'Ernie-core', img: 'https://sesameworkshop.org/wp-content/uploads/2023/03/presskit_ss_bio_ernie.png', prompt: 'A vibrant, normcore-inspired look inspired by Ernie. The model has slightly messy, cheerful orange-red hair. The outfit is a high-quality, relaxed-fit sweater with bold horizontal red and blue stripes, paired with classic, light-wash denim jeans and iconic yellow sneakers. The key accessory is a bright yellow rubber ducky peeking out of a tote bag.' },
  { name: 'Formal', img: 'https://www.sherrihill.com/cdn/shop/files/65133818d45c0_705x.jpg?v=1728361109', prompt: 'A stunning formal wear gown, elegant and suitable for a black-tie event.' },
  { name: 'Futuristic', img: 'https://t4.ftcdn.net/jpg/06/47/96/35/360_F_647963546_dwkmiy8towjcGeK5kclTQus6vAzDjAS0.jpg', prompt: 'A sleek, futuristic outfit with metallic materials, sharp angles, and a minimalist sci-fi aesthetic.' },
  { name: 'Gothic', img: 'https://static.vecteezy.com/system/resources/thumbnails/044/514/891/small/a-goth-goddess-lounges-in-a-black-velvet-dress-embellished-with-silver-chains-and-a-statement-choker-commanding-attention-with-her-strikingly-pale-makeup-photo.jpg', prompt: 'A dark and dramatic Gothic outfit, featuring lace, velvet, and intricate details.' },
  { name: 'Grover-core', img: 'https://sesameworkshop.org/wp-content/uploads/2023/03/presskit_ss_bio_grover.png', prompt: 'A retro-futuristic superhero look inspired by Grover. The model has a windswept, heroic blue hairstyle. The outfit is a sleek, royal blue jumpsuit with a textured, furry finish, cinched with a bold pink belt. A dramatic, flowing pink cape and knee-high silver boots complete the super-suit.' },
  { name: 'Hip-Hop', img: 'https://static01.nyt.com/images/2015/03/08/t-magazine/08mens-look-sign-1/08mens-look-sign-1-articleLarge.jpg?quality=75&auto=webp&disable=upscale', prompt: 'An old-school Hip-Hop outfit with baggy jeans, a bright jacket, and statement sneakers.' },
  { name: 'LEGO-core', img: 'https://images.squarespace-cdn.com/content/v1/511f4a7ce4b083f0a83f6a49/1365344885660-2WSP8RGIQQBZWL9TY18C/image-asset.jpeg', prompt: 'A playful and structured outfit inspired by LEGO bricks, featuring primary colors, blocky silhouettes, and geometric patterns.' },
  { name: 'Minimalist', img: 'https://www.primermagazine.com/wp-content/uploads/2018/08/minimalist-fashion_tan-3.jpg', prompt: 'An elegant minimalist outfit with clean lines and a neutral color palette.' },
  { name: 'Oscar-core', img: 'https://sesameworkshop.org/wp-content/uploads/2023/02/presskit_ss_bio_oscar.png', prompt: 'A deconstructed, high-fashion grunge outfit inspired by Oscar the Grouch. The model sports a messy, artfully disheveled hairstyle with streaks of drab green. The look is all about layering: a ripped, oversized olive green sweater, paired with patchwork denim. Accessories are ironically chic: a designer metal trash can-shaped purse.' },
  { name: 'Preppy', img: 'https://assets.teenvogue.com/photos/67c20cf07f85bf305cd78b05/master/w_2560%2Cc_limit/2176245283', prompt: 'A classic Preppy look with collared shirts, argyle patterns, and a clean-cut, collegiate feel.' },
  { name: 'Punk', img: 'https://bradcatblog.wordpress.com/wp-content/uploads/2014/06/tk-2014-03-09-018-001-harajuku-600x900.jpg', prompt: 'An edgy Punk rock outfit with leather, studs, and a rebellious DIY spirit.' },
  { name: 'Rocker', img: 'https://images.squarespace-cdn.com/content/v1/60d5afc7fc617b78792815f4/1625480936841-23TONV27ZN47HVA1668R/punk-movement.jpg', prompt: 'A cool Rocker outfit with a band t-shirt, leather jacket, and distressed jeans.' },
  { name: 'Simpsons-core', img: 'https://platform.theverge.com/wp-content/uploads/sites/2/chorus/uploads/chorus_asset/file/13079153/the-simpsons-tv-series-cast-wallpaper-109911.0.0.1444767471.jpeg?quality=90&strip=all&crop=0,3.4613147178592,100,93.077370564282', prompt: 'A cartoonishly stylish look inspired by The Simpsons. Bright, color-blocked outfit in yellow, blue, and red. The hairstyle should be a nod to Marge\'s iconic blue beehive, but translated into a high-fashion updo.' },
  { name: 'SpongeBob-core', img: 'https://upload.wikimedia.org/wikipedia/en/thumb/3/3b/SpongeBob_SquarePants_main_characters.png/330px-SpongeBob_SquarePants_main_characters.png', prompt: 'A nautical and playful outfit inspired by SpongeBob. A crisp white collared shirt, brown shorts (or a pleated skirt), red tie, and high white socks with black shoes. The look is preppy but with a fun, cartoonish twist.' },
  { name: 'Streetwear', img: 'https://www.yellowbrick.co/wp-content/uploads/2023/02/Streetwear-style.jpg', prompt: 'A stylish streetwear outfit with graphic tees, sneakers, and a modern urban vibe.' },
  { name: 'The Count-core', img: 'https://sesameworkshop.org/wp-content/uploads/2023/03/presskit_ss_bio_count.png', prompt: 'A modern gothic aristocrat look inspired by The Count. The model has sleek, slicked-back black hair with a widow\'s peak. The outfit features a sharply tailored monocle and a high-collared, floor-length velvet cape over a crisp white shirt and waistcoat.' },
  { name: 'Twilight Vampire', img: 'https://imgix.bustle.com/uploads/image/2021/9/15/38e58ab4-d323-4034-911e-69fc6df9e2ee-artboard-1-copy.jpg?w=653&h=740&fit=crop&crop=faces&dpr=2', prompt: 'A moody, modern outfit inspired by the vampires of Twilight. A palette of cool blues, greys, and black. Think fitted leather jackets, dark wash jeans, stylish boots, and an overall air of effortless, timeless cool.' },
  { name: 'Twilight Werewolf', img: 'https://bookstr.com/wp-content/uploads/2022/11/wolf-pack-new-moon12.jpg', prompt: 'A rugged, earthy look inspired by the werewolves of Twilight. An outdoorsy style with flannel shirts, basic tees, ripped denim shorts or jeans, and practical, worn-in boots. The overall vibe is warm, approachable, and connected to nature.' },
  { name: 'Vintage', img: 'https://www.befunky.com/images/wp/wp-2015-08-vintage-style-photography-featured.jpg?auto=avif,webp&format=jpg&width=1136&crop=16:9', prompt: 'An authentic vintage outfit from the 1970s with bell bottoms and earthy tones.' },
  { name: 'Wednesday', img: 'https://assets.teenvogue.com/photos/6388e0d5456bcd8727891fe6/16:9/w_1280,c_limit/Comm_Wednesday-Shopping_Dec-2022_SOCIAL.jpg', prompt: 'A gothic academia look inspired by Wednesday Addams. A monochromatic black and white outfit with a sharp collared dress, platform loafers, and her signature braids.' },
];

const Tooltip = ({ text, children, position = 'top' }) => (
    <div className="relative group/tooltip">
        {children}
        <div className={`absolute ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} left-1/2 -translate-x-1/2 w-max px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap z-50`}>
            {text}
        </div>
    </div>
);

const TourStep = ({ step, onNext, onPrev, onEnd }) => {
    const steps = [
        { title: "Welcome to the AI Fashion Styler!", content: "This quick tour will walk you through how to create amazing new looks. Click 'Next' to begin.", selector: null, },
        { title: "1. Upload Your Photos", content: "Start by uploading one or more clear photos of yourself. The more angles you provide, the better the AI can maintain your likeness.", selector: "#upload-section", },
        { title: "2. Choose Your Styles", content: "Select from our curated list of styles, or get creative by describing your own look in the text box or uploading a style reference image.", selector: "#style-section", },
        { title: "3. Generate Your Looks", content: "Once you've selected your styles, click here to let the AI work its magic. Your new looks will appear in the thumbnail rail below the main preview.", selector: "#generate-section", },
        { title: "4. Browse & Manage Your Images", content: "You can navigate your generated images here. Use the arrows, click a thumbnail, or use your keyboard's arrow keys to browse. Hover over a thumbnail to find options to regenerate or delete it.", selector: "#thumbnail-section", },
        { title: "5. Interact with Your Look", content: "Your currently selected look is shown here. Use the buttons on the top right to edit with AI, find similar items to shop, download, copy, or delete the image.", selector: "#preview-section", },
        { title: "You're all set!", content: "That's everything you need to know to get started. Have fun exploring new styles!", selector: null, },
    ];

    const currentStep = steps[step];
    const targetElement = currentStep.selector ? document.querySelector(currentStep.selector) : null;
    const highlightStyle = targetElement ? {
        top: `${targetElement.offsetTop - 12}px`, left: `${targetElement.offsetLeft - 12}px`,
        width: `${targetElement.offsetWidth + 24}px`, height: `${targetElement.offsetHeight + 24}px`,
    } : { top: '50%', left: '50%', width: '0', height: '0', transform: 'translate(-50%, -50%)' };

    return (
        <div className="fixed inset-0 z-[100]">
            <div className="absolute inset-0" style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.7)' }} onClick={onEnd}></div>
            <div className="absolute rounded-lg border-2 border-white border-dashed transition-all duration-500 ease-in-out" style={highlightStyle}></div>
            <div className="absolute p-6 bg-white rounded-lg shadow-2xl max-w-sm animate-fade-in-fast" style={{
                top: targetElement ? `${targetElement.offsetTop + targetElement.offsetHeight + 20}px` : '50%',
                left: targetElement ? `${targetElement.offsetLeft}px` : '50%',
                transform: !targetElement ? 'translate(-50%, -50%)' : 'none',
            }}>
                <h3 className="text-lg font-bold mb-2">{currentStep.title}</h3>
                <p className="text-sm text-gray-600 mb-4">{currentStep.content}</p>
                <div className="flex justify-between items-center">
                    <button onClick={onEnd} className="text-xs text-gray-500 hover:text-gray-800">End Tour</button>
                    <div className="flex gap-2">
                        {step > 0 && <button onClick={onPrev} className="text-sm bg-gray-200 px-3 py-1 rounded-md hover:bg-gray-300">Previous</button>}
                        {step < steps.length - 1 ? (
                            <button onClick={onNext} className="text-sm bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700">Next</button>
                        ) : (
                            <button onClick={onEnd} className="text-sm bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700">Finish</button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};


const ShopTheLookModal = ({ look, onClose, onShop }) => {
  useEffect(() => { if (look && !look.shoppingDetails) { onShop(look); } }, [look, onShop]);

  if (!look) return null;

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 animate-fade-in-fast">
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col lg:flex-row cursor-default overflow-hidden">
        <div className="w-full lg:w-1/2 flex-shrink-0 bg-gray-100"><img src={look.image} alt={`Shopping for ${look.displayName}`} className="w-full h-full object-contain" /></div>
        <div className="w-full lg:w-1/2 p-8 flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3"><span className="material-symbols-outlined text-3xl text-blue-600">shopping_bag</span><div><h2 className="text-2xl font-bold text-gray-900">Shop The Look</h2><p className="text-gray-600 mt-1">Inspired by "{look.displayName}"</p></div></div>
            <Tooltip text="Close" position="bottom"><button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors"><span className="material-symbols-outlined">close</span></button></Tooltip>
          </div>
          <div className="flex-1 overflow-y-auto">
            {look.shoppingDetails ? (
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: look.shoppingDetails }} />
            ) : (
              <div className="text-center py-8 flex flex-col items-center justify-center h-full">
                <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <p className="mt-3 font-medium text-gray-600">Finding similar items...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ImageEditorModal = ({ look, onClose, onRegenerate }) => {
    const [prompt, setPrompt] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const canvasRef = useRef(null);
    const maskCanvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    const getCanvasCoordinates = (event) => {
        const canvas = maskCanvasRef.current; const rect = canvas.getBoundingClientRect(); const scaleX = canvas.width / rect.width; const scaleY = canvas.height / rect.height;
        const clientX = event.clientX || event.touches[0].clientX; const clientY = event.clientY || event.touches[0].clientY;
        return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    };
    const startDrawing = (event) => {
        event.preventDefault(); setIsDrawing(true); const { x, y } = getCanvasCoordinates(event);
        const ctx = maskCanvasRef.current.getContext('2d'); ctx.beginPath(); ctx.moveTo(x, y);
    };
    const draw = (event) => {
        if (!isDrawing) return; event.preventDefault(); const { x, y } = getCanvasCoordinates(event);
        const ctx = maskCanvasRef.current.getContext('2d'); ctx.lineTo(x, y); ctx.stroke();
    };
    const stopDrawing = () => {
        if (!isDrawing) return; const ctx = maskCanvasRef.current.getContext('2d'); ctx.closePath(); setIsDrawing(false);
    };
    const handleRegenerateClick = () => {
        const maskCanvas = maskCanvasRef.current; const tempCanvas = document.createElement('canvas');
        tempCanvas.width = maskCanvas.width; tempCanvas.height = maskCanvas.height; const tempCtx = tempCanvas.getContext('2d');
        const imageData = maskCanvas.getContext('2d').getImageData(0, 0, maskCanvas.width, maskCanvas.height); const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 0) { data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; } 
            else { data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; }
            data[i + 3] = 255;
        }
        tempCtx.putImageData(imageData, 0, 0);
        const maskBase64 = tempCanvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, "");
        onRegenerate(look, prompt, maskBase64); onClose();
    };

    useEffect(() => {
        const image = new Image(); image.crossOrigin = "Anonymous"; image.src = look.image;
        image.onload = () => {
            const canvas = canvasRef.current; const maskCanvas = maskCanvasRef.current; const ctx = canvas.getContext('2d'); const maskCtx = maskCanvas.getContext('2d');
            canvas.width = image.naturalWidth; canvas.height = image.naturalHeight; maskCanvas.width = image.naturalWidth; maskCanvas.height = image.naturalHeight;
            ctx.drawImage(image, 0, 0);
            maskCtx.strokeStyle = 'rgba(255, 105, 180, 0.7)'; maskCtx.lineWidth = 50; maskCtx.lineJoin = 'round'; maskCtx.lineCap = 'round';
        };
    }, [look.image]);

    return (
        <div onClick={onClose} className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 animate-fade-in-fast">
            <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col cursor-default overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h2 className="text-xl font-bold text-gray-900">Edit Look with AI</h2>
                    <Tooltip text="Close editor"><button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors"><span className="material-symbols-outlined">close</span></button></Tooltip>
                </div>
                <div className="flex-1 flex flex-col lg:flex-row p-4 gap-4 overflow-y-auto">
                    <div className="w-full lg:w-2/3 flex-shrink-0 relative bg-gray-200 rounded-lg">
                        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-contain" />
                        <canvas ref={maskCanvasRef} className={`absolute inset-0 w-full h-full object-contain ${isEditing ? 'cursor-crosshair' : 'cursor-default'}`}
                            onMouseDown={isEditing ? startDrawing : null} onMouseMove={isEditing ? draw : null} onMouseUp={isEditing ? stopDrawing : null}
                            onTouchStart={isEditing ? startDrawing : null} onTouchMove={isEditing ? draw : null} onTouchEnd={isEditing ? stopDrawing : null}
                        />
                    </div>
                    <div className="w-full lg:w-1/3 flex flex-col gap-4">
                        <div>
                            <label className="font-medium text-gray-700">1. Select Area to Change</label>
                            <p className="text-sm text-gray-500 mb-2">Click below and draw over the part of the image you want to modify.</p>
                            <Tooltip text={isEditing ? "Finish your selection" : "Start selecting an area"}><button onClick={() => setIsEditing(!isEditing)} className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg transition-all ${isEditing ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                                <span className="material-symbols-outlined">{isEditing ? 'done' : 'draw'}</span>{isEditing ? "Finish Drawing" : "Start Drawing"}
                            </button></Tooltip>
                        </div>
                         <div>
                            <label htmlFor="edit-prompt" className="font-medium text-gray-700">2. Describe Your Change</label>
                            <p className="text-sm text-gray-500 mb-2">Examples: "Make the jacket red", "Add a necklace", "Change the background to a beach".</p>
                            <textarea id="edit-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows="3" placeholder="Enter your edit prompt..." className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"></textarea>
                        </div>
                        <div className="mt-auto">
                           <Tooltip text="Apply your edit to the selected area"><button onClick={handleRegenerateClick} disabled={!prompt} className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-3 px-4 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-400">
                              <span className="material-symbols-outlined">auto_awesome</span> Regenerate
                           </button></Tooltip>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function App() {
  const [isAppReady, setIsAppReady] = useState(false);
  const [initializationError, setInitializationError] = useState(null);
  const [fashionStyles, setFashionStyles] = useState(INITIAL_FASHION_STYLES);
  const [originalImages, setOriginalImages] = useState([]);
  const [originalImagesBase64, setOriginalImagesBase64] = useState([]);
  const [selectedStyles, setSelectedStyles] = useState([]);
  const [customStyle, setCustomStyle] = useState('');
  const [generatedImages, setGeneratedImages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeImage, setActiveImage] = useState({ type: 'original', id: null });
  const [largeViewImage, setLargeViewImage] = useState(null);
  const [shoppingLook, setShoppingLook] = useState(null);
  const [editingLook, setEditingLook] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [isTourActive, setIsTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [isSidepanelOpen, setIsSidepanelOpen] = useState(true);
  const [sidepanelWidth, setSidepanelWidth] = useState(480);
  const [isResizing, setIsResizing] = useState(false);
  const [analytics, setAnalytics] = useState({ users: 0, generations: 0 });
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const generationQueueRef = useRef([]);
  const thumbnailRailRef = useRef(null);
  const dbRef = useRef(null);
  const analyticsRef = useRef(null);
  
  useEffect(() => {
    const initialize = async () => {
      try {
        const appId = import.meta.env.VITE_APP_ID || 'default-app-id';
        const firebaseConfig = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG || '{}');
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        dbRef.current = getFirestore(app);
        await signInAnonymously(auth);
        if (!auth.currentUser?.uid) throw new Error("Authentication failed.");
        
        const statsRef = doc(dbRef.current, `artifacts/${appId}/public/data/analytics/stats`);
        const visitedKey = `visited-${appId}`;
        if (!localStorage.getItem(visitedKey)) {
          await setDoc(statsRef, { uniqueUsers: increment(1) }, { merge: true });
          localStorage.setItem(visitedKey, 'true');
        }
        const statsSnap = await getDoc(statsRef);
        if (statsSnap.exists()) { setAnalytics({ users: statsSnap.data().uniqueUsers || 0, generations: statsSnap.data().totalGenerations || 0 }); }
      } catch (e) { console.error("Initialization failed:", e); setInitializationError("Could not initialize the application. Please refresh the page."); } 
      finally { setIsAppReady(true); }
    };
    initialize();
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
        if (analyticsRef.current && !analyticsRef.current.contains(event.target)) {
            setIsAnalyticsOpen(false);
        }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [analyticsRef]);

  const incrementGenerationCount = useCallback(async () => {
    const appId = import.meta.env.VITE_APP_ID || 'default-app-id';
    const statsRef = doc(dbRef.current, `artifacts/${appId}/public/data/analytics/stats`);
    await setDoc(statsRef, { totalGenerations: increment(1) }, { merge: true });
    setAnalytics(prev => ({...prev, generations: prev.generations + 1}));
  }, []);

  useEffect(() => { if (toastMessage) { const timer = setTimeout(() => setToastMessage(''), 3000); return () => clearTimeout(timer); } }, [toastMessage]);

  useEffect(() => {
    const fontLink = document.createElement('link'); fontLink.href = "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Google+Sans:wght@400;500;700&display=swap"; fontLink.rel = 'stylesheet'; document.head.appendChild(fontLink);
    const materialSymbolsLink = document.createElement('link'); materialSymbolsLink.href = "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"; materialSymbolsLink.rel = 'stylesheet'; document.head.appendChild(materialSymbolsLink);
  }, []);
  
  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    setGeneratedImages([]); setError(null); setOriginalImages([]); setOriginalImagesBase64([]);
    const fileReadPromises = files.map(file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve({ url: reader.result, base64: reader.result.replace(/^data:image\/(png|jpeg|jpg);base64,/, "") });
        reader.onerror = reject; reader.readAsDataURL(file);
    }));
    Promise.all(fileReadPromises).then(results => {
      setOriginalImages(results.map(r => r.url)); setOriginalImagesBase64(results.map(r => r.base64)); setActiveImage({ type: 'original', id: 0 });
    });
  };
  
  const handleStyleImageUpload = (event) => {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
        const userStyleImg = reader.result; const base64 = userStyleImg.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
        const styleName = `Custom Style ${fashionStyles.filter(s => s.isUserUploaded).length + 1}`;
        const newStyle = { name: styleName, img: userStyleImg, prompt: 'USER_UPLOADED_STYLE', isUserUploaded: true, base64: base64 };
        setFashionStyles(prev => [newStyle, ...prev]); setSelectedStyles(prev => [styleName, ...prev]);
    };
    reader.readAsDataURL(file);
  };

  const toggleStyleSelection = (styleName) => setSelectedStyles(prev => prev.includes(styleName) ? prev.filter(s => s !== styleName) : [...prev, styleName]);

  const processGenerationQueue = useCallback(async () => {
    if (generationQueueRef.current.length === 0) { setIsLoading(false); setActiveImage(prev => ({ ...prev, type: prev.id === 'original' || prev.id === 0 ? 'original' : 'generated' })); return; }
    const { style, prompt, styleBase64, editInfo } = generationQueueRef.current.shift();
    setActiveImage({ type: 'loading', style: style });
    let parts = []; let textPrompt;
    if (editInfo) {
        textPrompt = editInfo.prompt; parts.push({ text: textPrompt });
        parts.push({ inlineData: { mimeType: "image/png", data: editInfo.baseImage.replace(/^data:image\/(png|jpeg|jpg);base64,/, "") } });
        parts.push({ inlineData: { mimeType: "image/png", data: editInfo.mask } });
    } else {
        if (prompt === 'USER_UPLOADED_STYLE') { textPrompt = `Recreate the person from the reference photos in the artistic style of the following image. Preserve the person's identity, pose, and facial features from the original photos, but apply the colors, textures, and overall aesthetic of the style image to their clothing and appearance.`; } 
        else if (style === 'Custom') { textPrompt = `A high-fashion, photorealistic shot of the person in the reference photos. They should be wearing an outfit best described as: '${prompt}'. Ensure the style is chic, visually interesting, and matches the user's description.`; } 
        else { textPrompt = `A hyper-photorealistic, fashion editorial quality, sharp focus shot of the person in the reference photos, reimagined in the following style: ${makePromptDynamic(prompt)}. It is crucial to preserve the person's identity, pose, and facial features from the reference photos. The new clothing, hair, and makeup should look natural on them, fitting their body shape and pose. Keep the original background.`; }
        parts = [ { text: textPrompt }, ...originalImagesBase64.map(b64 => ({ inlineData: { mimeType: "image/jpeg", data: b64 } })) ];
        if (prompt === 'USER_UPLOADED_STYLE') parts.push({ inlineData: { mimeType: "image/jpeg", data: styleBase64 } });
    }
    const payload = { contents: [{ parts }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } };
    try {
      const response = await fetch(IMAGE_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(`API error for ${style}: ${response.status} ${response.statusText}`);
      const result = await response.json(); const base64Data = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
      if (base64Data) {
        setGeneratedImages(prev => {
          const styleCount = prev.filter(p => p.style === style).length; const displayName = styleCount > 0 ? `${style} (${styleCount + 1})` : style;
          const newLook = { id: crypto.randomUUID(), style, displayName, image: `data:image/png;base64,${base64Data}`, prompt, styleBase64 };
          setActiveImage({ type: 'generated', id: newLook.id }); 
          incrementGenerationCount();
          return [...prev, newLook];
        });
      } else throw new Error(`No image data returned for ${style}. This can happen with very short or ambiguous custom prompts. Try being more descriptive.`);
    } catch (e) { console.error(e); setError(e.message); } 
    finally { await processGenerationQueue(); }
  }, [originalImagesBase64, incrementGenerationCount]);

  const startGeneration = useCallback(() => {
    if (originalImagesBase64.length === 0 || (selectedStyles.length === 0 && !customStyle.trim())) { setError("Please upload at least one photo and select or enter at least one style."); return; }
    setIsLoading(true); setError(null);
    const queue = selectedStyles.map(styleName => {
        const styleData = fashionStyles.find(s => s.name === styleName);
        return { style: styleName, prompt: styleData.prompt, styleBase64: styleData.base64 || null };
    });
    if (customStyle.trim()) queue.push({ style: 'Custom', prompt: customStyle.trim(), styleBase64: null });
    generationQueueRef.current = [...generationQueueRef.current, ...queue]; 
    if(generationQueueRef.current.length > 0 && !isLoading) processGenerationQueue();
  }, [originalImagesBase64, selectedStyles, customStyle, fashionStyles, processGenerationQueue, isLoading]);

  const handleRegenerate = useCallback((prompt, style, styleBase64) => {
    if (originalImagesBase64.length === 0) return;
    generationQueueRef.current.push({ style, prompt, styleBase64 });
    if (!isLoading) { setIsLoading(true); setError(null); processGenerationQueue(); }
  }, [isLoading, originalImagesBase64, processGenerationQueue]);
  
  const handleEditRegenerate = useCallback((look, prompt, mask) => {
    if (!look) return; const newJob = { style: `${look.style} (edit)`, editInfo: { baseImage: look.image, prompt, mask } };
    generationQueueRef.current.push(newJob); if(!isLoading) { setIsLoading(true); setError(null); processGenerationQueue(); }
  }, [isLoading, processGenerationQueue]);

  const handleShopTheLook = useCallback(async (look) => {
      const lookIndex = generatedImages.findIndex(img => img.id === look.id);
      if (lookIndex === -1 || (look.shoppingDetails && look.shoppingDetails !== 'ERROR')) return;
      const base64Data = look.image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
      const payload = { 
        contents: [{ parts: [ { text: "Analyze the outfit in the image. Identify the main, distinct clothing items and accessories (e.g., 'Jacket', 'Pants', 'Shoes', 'Sunglasses')." }, { inlineData: { mimeType: "image/jpeg", data: base64Data } } ] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: { type: "OBJECT", properties: { items: { type: "ARRAY", items: { type: "OBJECT", properties: { itemName: { type: "STRING" }, description: { type: "STRING" }, googleShoppingQuery: { type: "STRING" }, estimatedPrice: { type: "STRING" } }, required: ["itemName", "description", "googleShoppingQuery", "estimatedPrice"] } } } }
        }
      };
      try {
          const response = await fetch(TEXT_API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
          if (!response.ok) throw new Error("API error while generating shopping details.");
          const result = await response.json(); const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
          if (jsonText) {
              const shoppingData = JSON.parse(jsonText);
              const detailsHtml = shoppingData.items.map(item => `
                <a href="https://www.google.com/search?tbm=shop&q=${encodeURIComponent(item.googleShoppingQuery)}" target="_blank" rel="noopener noreferrer" class="block p-4 rounded-lg border hover:bg-gray-50 hover:border-blue-500 no-underline text-gray-800 mb-2 transition-colors">
                    <div class="flex items-start gap-4">
                        <div class="flex-1"> <h4 class="font-bold">${item.itemName}</h4> <p class="text-sm text-gray-600">${item.description}</p> <p class="text-xs font-semibold text-gray-800 mt-1">Est. Price: ${item.estimatedPrice}</p> </div>
                    </div>
                </a>`).join('');
              setGeneratedImages(prev => { const newImages = [...prev]; newImages[lookIndex].shoppingDetails = detailsHtml; return newImages; });
              setShoppingLook(prev => ({...prev, shoppingDetails: detailsHtml}));
          } else throw new Error("Could not parse shopping details from API response.");
      } catch(e) { 
        console.error(e); const errorHtml = "<p>Could not analyze the outfit. Please try again later.</p>";
        setGeneratedImages(prev => { const newImages = [...prev]; newImages[lookIndex].shoppingDetails = errorHtml; return newImages; });
        setShoppingLook(prev => ({...prev, shoppingDetails: errorHtml}));
      }
  }, [generatedImages]);

  const activeImageUrl = () => {
    if (activeImage.type === 'original') return originalImages[activeImage.id] || null;
    if (activeImage.type === 'generated') return generatedImages.find(i => i.id === activeImage.id)?.image || null;
    return originalImages[0] || null;
  };
  
  const handleSelectAll = () => setSelectedStyles(prev => prev.length === fashionStyles.length ? [] : fashionStyles.map(s => s.name));
  const scrollThumbnails = (direction) => thumbnailRailRef.current?.scrollBy({ left: direction * 300, behavior: 'smooth' });
  const handleThumbnailKeyDown = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; e.preventDefault();
    const allThumbnails = [ ...originalImages.map((_, i) => ({ type: 'original', id: i })), ...generatedImages.map(g => ({ type: 'generated', id: g.id })) ];
    const currentIndex = allThumbnails.findIndex(t => t.type === activeImage.type && t.id === activeImage.id);
    let nextIndex = (e.key === 'ArrowRight') ? (currentIndex + 1) % allThumbnails.length : (currentIndex - 1 + allThumbnails.length) % allThumbnails.length;
    const nextActiveImage = allThumbnails[nextIndex]; setActiveImage(nextActiveImage);
    document.getElementById(`thumbnail-${nextActiveImage.type}-${nextActiveImage.id}`)?.focus();
  };
  const handleDeleteImage = (id) => {
      if(window.confirm("Are you sure you want to delete this image?")) {
        setGeneratedImages(prev => prev.filter(img => img.id !== id));
        if (activeImage.id === id) { setActiveImage({ type: 'original', id: 0 }); }
        setToastMessage("Image deleted.");
      }
  };
  const handleCopyImage = async (imageUrl) => {
      try {
        const response = await fetch(imageUrl); const blob = await response.blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]); setToastMessage("Image copied to clipboard!");
      } catch (err) { console.error("Failed to copy image: ", err); setToastMessage("Failed to copy image."); }
  };
  const handleDownloadImage = (imageUrl, filename) => {
      const link = document.createElement('a'); link.href = imageUrl; link.download = filename || 'fashion-styler-image.png';
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      setToastMessage("Image download started.");
  };

  const handleResizeMouseDown = (e) => { e.preventDefault(); setIsResizing(true); };
  const handleResizeMouseUp = useCallback(() => setIsResizing(false), []);
  const handleResizeMouseMove = useCallback((e) => {
      if (isResizing) {
          let newWidth = e.clientX;
          if (newWidth < 380) newWidth = 380;
          if (newWidth > 600) newWidth = 600;
          setSidepanelWidth(newWidth);
      }
  }, [isResizing]);

  useEffect(() => {
    window.addEventListener('mousemove', handleResizeMouseMove);
    window.addEventListener('mouseup', handleResizeMouseUp);
    return () => {
        window.removeEventListener('mousemove', handleResizeMouseMove);
        window.removeEventListener('mouseup', handleResizeMouseUp);
    };
  }, [handleResizeMouseMove, handleResizeMouseUp]);


  if (!isAppReady) return (<div className="w-screen h-screen flex flex-col items-center justify-center bg-gray-100 text-gray-700"><span className="material-symbols-outlined text-6xl text-blue-500 animate-spin">autorenew</span><h2 className="text-2xl font-medium mt-4">Initializing Studio...</h2>{initializationError && <p className="text-red-500 mt-2">{initializationError}</p>}</div>);
  
  return (
    <div style={{ fontFamily: "Google Sans, sans-serif" }} className="bg-gray-100 min-h-screen text-gray-800">
      {isTourActive && <TourStep step={tourStep} onNext={() => setTourStep(s => s + 1)} onPrev={() => setTourStep(s => s - 1)} onEnd={() => setIsTourActive(false)} />}
      {shoppingLook && <ShopTheLookModal look={shoppingLook} onClose={() => setShoppingLook(null)} onShop={handleShopTheLook} />}
      {editingLook && <ImageEditorModal look={editingLook} onClose={() => setEditingLook(null)} onRegenerate={handleEditRegenerate} />}
      {toastMessage && <div className="fixed bottom-4 right-4 bg-gray-800 text-white py-2 px-4 rounded-lg shadow-lg z-[60] animate-fade-in">{toastMessage}</div>}
      
      <div className="flex h-screen">
        <div style={{width: isSidepanelOpen ? `${sidepanelWidth}px` : '0px', padding: isSidepanelOpen ? '1.25rem' : '0'}} className={`bg-white border-r border-gray-200 flex flex-col gap-4 overflow-y-auto transition-all duration-300 ease-in-out relative`}>
          <div className={`${!isSidepanelOpen && 'hidden'}`}>
            <header>
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2 whitespace-nowrap"><span className="material-symbols-outlined text-3xl text-blue-600">styler</span>AI Fashion Styler</h1>
                    <div ref={analyticsRef} className="flex items-center gap-2 relative">
                        <Tooltip text="View App Analytics">
                            <button onClick={() => setIsAnalyticsOpen(prev => !prev)} className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 p-1.5 rounded-full hover:bg-blue-50">
                                <span className="material-symbols-outlined !text-xl">monitoring</span>
                            </button>
                        </Tooltip>
                        <Tooltip text="Start Interactive Tour">
                            <button onClick={() => {setIsTourActive(true); setTourStep(0);}} className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 p-1.5 rounded-full hover:bg-blue-50">
                                <span className="material-symbols-outlined !text-xl">help</span>
                            </button>
                        </Tooltip>
                        {isAnalyticsOpen && (
                            <div className="absolute top-full right-0 mt-2 bg-white rounded-lg shadow-xl border p-4 z-20 w-60 animate-fade-in-fast">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-bold text-gray-800 text-base">App Analytics</h3>
                                    <button onClick={() => setIsAnalyticsOpen(false)} className="text-gray-400 hover:text-gray-700 -mr-2 -mt-2"><span className="material-symbols-outlined">close</span></button>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Unique Users</span>
                                        <strong className="text-gray-900">{analytics.users}</strong>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Total Generations</span>
                                        <strong className="text-gray-900">{analytics.generations}</strong>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                 <p className="text-gray-600 text-sm mt-1 whitespace-nowrap">Visualize yourself in different styles.</p>
            </header>

            <div id="upload-section">
                <div className="flex items-center gap-3 mt-4 mb-2"><span className="w-7 h-7 flex items-center justify-center bg-blue-600 text-white rounded-full font-bold text-sm">1</span><h2 className="text-lg font-medium text-gray-800 whitespace-nowrap">Upload Photos</h2></div>
                <label htmlFor="file-upload" title="Click to upload your photos" className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-6 py-4 text-center hover:border-blue-500 transition-colors">
                    <span className="material-symbols-outlined text-4xl text-gray-400">add_a_photo</span>
                    <p className="mt-1 text-xs text-gray-600"><span className="font-semibold text-blue-600">Click to upload</span> (<em>multiple supported</em>)</p>
                    <input id="file-upload" type="file" multiple className="sr-only" accept="image/png, image/jpeg, image/jpg" onChange={handleImageUpload} />
                </label>
                {originalImages.length > 0 && ( <div className="mt-2 grid grid-cols-5 gap-2"> {originalImages.map((img, index) => <Tooltip key={`orig-thumb-${index}`} text={`View original image ${index+1}`}><img src={img} className={`w-full aspect-square object-cover rounded-md border-2 ${activeImage.type === 'original' && activeImage.id === index ? 'border-blue-500' : 'border-transparent'}`} onClick={() => setActiveImage({ type: 'original', id: index })} /></Tooltip>)} </div> )}
            </div>

            <div id="style-section">
                <div className="flex items-center justify-between mt-4 mb-2">
                    <div className="flex items-center gap-3"><span className="w-7 h-7 flex items-center justify-center bg-blue-600 text-white rounded-full font-bold text-sm">2</span><h2 className="text-lg font-medium text-gray-800 whitespace-nowrap">Choose Styles</h2></div>
                    <Tooltip text={selectedStyles.length === fashionStyles.length ? 'Deselect all styles' : 'Select all styles'}><button onClick={handleSelectAll} className="text-sm font-medium text-blue-600 hover:text-blue-800">{selectedStyles.length === fashionStyles.length ? 'Deselect All' : 'Select All'}</button></Tooltip>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                <input type="text" value={customStyle} onChange={(e) => setCustomStyle(e.target.value)} placeholder="Describe your own style..." className="w-full col-span-2 pl-3 pr-9 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500" />
                <label htmlFor="style-upload" title="Upload an image to use as a style reference" className="col-span-2 flex items-center justify-center gap-2 w-full text-sm font-medium border border-gray-300 rounded-lg py-2 px-4 hover:bg-gray-50 cursor-pointer">
                    <span className="material-symbols-outlined !text-base">upload</span> Upload Style Image
                    <input id="style-upload" type="file" className="sr-only" accept="image/png, image/jpeg" onChange={handleStyleImageUpload} />
                </label>
                </div>
                <div className="grid grid-cols-3 gap-2">
                {fashionStyles.map(style => (
                    <Tooltip key={style.name} text={`Select ${style.name} style`}><button onClick={() => toggleStyleSelection(style.name)} className={`relative rounded-lg overflow-hidden h-24 w-full group focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all ${selectedStyles.includes(style.name) ? 'ring-4 ring-blue-500 ring-inset' : 'ring-1 ring-gray-300 hover:ring-blue-400'}`}>
                    <img src={style.img} alt={style.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    <div className={`absolute inset-0 bg-black transition-opacity ${selectedStyles.includes(style.name) ? 'bg-opacity-50' : 'bg-opacity-40'}`}></div>
                    <span className="absolute bottom-1 left-2 text-white font-bold text-xs">{style.name}</span>
                    {selectedStyles.includes(style.name) && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white rounded-full p-1"><span className="material-symbols-outlined !text-xl">check</span></div>}
                    </button></Tooltip>
                ))}
                </div>
            </div>

            <div id="generate-section" className="flex flex-col gap-2 mt-auto pt-4">
                <div className="flex items-center gap-3"><span className="w-7 h-7 flex items-center justify-center bg-blue-600 text-white rounded-full font-bold text-sm">3</span><h2 className="text-lg font-medium text-gray-800 whitespace-nowrap">Generate</h2></div>
                <Tooltip text="Generate looks from your selected styles"><button onClick={startGeneration} disabled={originalImages.length === 0 || isLoading} className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all">
                {isLoading ? (<><svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Generating...</span></>) : (<><span className="material-symbols-outlined">auto_awesome</span><span>Generate Looks</span></>)}
                </button></Tooltip>
                {error && <p className="text-red-600 text-center text-sm font-medium">{error}</p>}
            </div>
          </div>
        </div>

        <div onMouseDown={handleResizeMouseDown} className="w-2 cursor-col-resize flex items-center justify-center group/resizer">
            <button onClick={() => setIsSidepanelOpen(!isSidepanelOpen)} className="h-12 w-full flex items-center justify-center" title={isSidepanelOpen ? "Hide Controls" : "Show Controls"}>
                 <div className={`transition-colors h-full w-1 rounded-full ${isResizing ? 'bg-blue-500' : 'bg-gray-300 group-hover/resizer:bg-blue-400'}`}></div>
            </button>
        </div>

        <main className="flex-1 bg-gray-200 flex flex-col items-center justify-center p-4 md:p-8 overflow-hidden relative">
            <div className="w-full h-full bg-white rounded-2xl shadow-inner-lg flex flex-col p-4 gap-4">
                <div id="preview-section" className="relative w-full flex-1 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center group/main">
                    {!activeImageUrl() ? (<div className="text-center text-gray-500 p-8"><span className="material-symbols-outlined text-6xl text-gray-300">person</span><h3 className="mt-4 text-lg font-semibold text-gray-700">Your new look will appear here</h3><p className="mt-1 text-gray-500">Upload photo(s) to get started.</p></div>) : (<>
                    <img onDoubleClick={() => setLargeViewImage(activeImageUrl())} key={activeImage.id} src={activeImageUrl()} alt="Main content" className="w-full h-full object-contain transition-opacity duration-300 animate-fade-in"/>
                    {activeImage.type === 'generated' && (
                        <div className="absolute top-4 right-4 flex items-center gap-2">
                            <Tooltip text="Edit with AI" position="bottom"><button onClick={() => setEditingLook(generatedImages.find(img => img.id === activeImage.id))} className="flex items-center gap-2 bg-white/80 backdrop-blur-sm text-gray-800 font-bold p-2 rounded-lg shadow-lg hover:bg-white transition-all"><span className="material-symbols-outlined">edit</span></button></Tooltip>
                            <Tooltip text="Shop the Look" position="bottom"><button onClick={() => setShoppingLook(generatedImages.find(img => img.id === activeImage.id))} className="flex items-center gap-2 bg-white/80 backdrop-blur-sm text-gray-800 font-bold p-2 rounded-lg shadow-lg hover:bg-white transition-all"><span className="material-symbols-outlined">shopping_bag</span></button></Tooltip>
                            <Tooltip text="Copy Image" position="bottom"><button onClick={() => handleCopyImage(activeImageUrl())} className="flex items-center gap-2 bg-white/80 backdrop-blur-sm text-gray-800 font-bold p-2 rounded-lg shadow-lg hover:bg-white transition-all"><span className="material-symbols-outlined">content_copy</span></button></Tooltip>
                            <Tooltip text="Download Image" position="bottom"><button onClick={() => handleDownloadImage(activeImageUrl(), `${generatedImages.find(img => img.id === activeImage.id)?.displayName}.png`)} className="flex items-center gap-2 bg-white/80 backdrop-blur-sm text-gray-800 font-bold p-2 rounded-lg shadow-lg hover:bg-white transition-all"><span className="material-symbols-outlined">download</span></button></Tooltip>
                            <Tooltip text="Delete Image" position="bottom"><button onClick={() => handleDeleteImage(activeImage.id)} className="flex items-center gap-2 bg-red-500/80 backdrop-blur-sm text-white font-bold p-2 rounded-lg shadow-lg hover:bg-red-500 transition-all"><span className="material-symbols-outlined">delete</span></button></Tooltip>
                        </div>
                    )}
                    </>)}
                </div>

                {originalImages.length > 0 && (
                    <div id="thumbnail-section" className="relative w-full flex-shrink-0 flex items-center justify-center">
                        <button onClick={() => scrollThumbnails(-1)} title="Scroll left" className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/80 rounded-full shadow-md p-1 hover:bg-white"><span className="material-symbols-outlined">chevron_left</span></button>
                        <div ref={thumbnailRailRef} tabIndex="0" onKeyDown={handleThumbnailKeyDown} className="flex items-center justify-start gap-4 p-2 overflow-x-auto scroll-smooth snap-x snap-mandatory focus:outline-none" style={{ scrollbarWidth: 'none' }}>
                            {originalImages.map((img, index) => (<div key={`orig-${index}`} className="text-center flex-shrink-0 snap-center"><Tooltip text={`View original image ${index + 1}`}><button id={`thumbnail-original-${index}`} onDoubleClick={() => setLargeViewImage(img)} onClick={() => setActiveImage({ type: 'original', id: index })} className={`w-24 h-24 rounded-lg overflow-hidden border-2 transition-all duration-300 cursor-pointer ${activeImage.type === 'original' && activeImage.id === index ? 'border-blue-500 scale-105' : 'border-transparent hover:border-gray-400'}`}><img src={img} alt={`Original Thumbnail ${index + 1}`} className="w-full h-full object-cover"/></button></Tooltip><p className={`text-xs font-medium mt-1.5 transition-colors ${activeImage.type === 'original' && activeImage.id === index ? 'text-blue-600' : 'text-gray-600'}`}>Original {index + 1}</p></div>))}
                            {generatedImages.map((genImg) => (<div key={genImg.id} className="text-center flex-shrink-0 snap-center relative group/thumb"><Tooltip text={`View ${genImg.displayName}`}><button id={`thumbnail-generated-${genImg.id}`} onDoubleClick={() => setLargeViewImage(genImg.image)} onClick={() => setActiveImage({ type: 'generated', id: genImg.id })} className={`w-24 h-24 rounded-lg overflow-hidden border-2 transition-all duration-300 cursor-pointer ${activeImage.type === 'generated' && activeImage.id === genImg.id ? 'border-blue-500 scale-105' : 'border-transparent hover:border-gray-400'}`}><img src={genImg.image} alt={`${genImg.displayName} Thumbnail`} className="w-full h-full object-cover"/></button></Tooltip>
                            <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                                <Tooltip text="Regenerate"><button onClick={(e) => {e.stopPropagation(); handleRegenerate(genImg.prompt, genImg.style, genImg.styleBase64)}} className="bg-black/60 text-white rounded p-0.5 hover:bg-black/80"><span className="material-symbols-outlined !text-sm">autorenew</span></button></Tooltip>
                                <Tooltip text="Delete"><button onClick={(e) => {e.stopPropagation(); handleDeleteImage(genImg.id)}} className="bg-red-500/80 text-white rounded p-0.5 hover:bg-red-500"><span className="material-symbols-outlined !text-sm">delete</span></button></Tooltip>
                            </div>
                            <p className={`text-xs font-medium mt-1.5 transition-colors ${activeImage.type === 'generated' && activeImage.id === genImg.id ? 'text-blue-600' : 'text-gray-600'}`}>{genImg.displayName}</p></div>))}
                            {activeImage.type === 'loading' && (<div className="text-center flex-shrink-0 snap-center"><div className="w-24 h-24 rounded-lg border-2 flex items-center justify-center bg-gray-200 transition-all duration-300 animate-pulse border-blue-500 scale-105"><span className="material-symbols-outlined text-gray-400 animate-spin">autorenew</span></div><p className="text-xs font-medium mt-1.5 text-blue-600">{activeImage.style}</p></div>)}
                        </div>
                        <button onClick={() => scrollThumbnails(1)} title="Scroll right" className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/80 rounded-full shadow-md p-1 hover:bg-white"><span className="material-symbols-outlined">chevron_right</span></button>
                    </div>
                )}
            </div>
        </main>
      </div>
       <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.5s ease-in-out; }
        @keyframes fade-in-fast { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in-fast { animation: fade-in-fast 0.2s ease-in-out; }
        .prose h4 { margin: 1em 0 0.5em 0; }
        .prose p { margin-top: 0; }
        .prose a { text-decoration: none; }
        .prose a:hover { opacity: 0.8; }
        .thumbnail-rail::-webkit-scrollbar { display: none; }
    `}</style>
    </div>
  );
}

