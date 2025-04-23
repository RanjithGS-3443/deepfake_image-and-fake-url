from PIL import Image, ImageDraw
import os

# Create icons directory if it doesn't exist
os.makedirs('icons', exist_ok=True)

# Create icons of different sizes
sizes = [16, 48, 128]
colors = [(0, 128, 0), (0, 100, 0), (0, 80, 0)]  # Different shades of green

for i, size in enumerate(sizes):
    # Create a new image with a green background
    img = Image.new('RGB', (size, size), color=colors[i])
    draw = ImageDraw.Draw(img)
    
    # Draw a simple shield shape
    margin = size // 4
    draw.rectangle([margin, margin, size - margin, size - margin], outline='white', width=max(1, size // 16))
    
    # Save the image
    img.save(f'icons/icon{size}.png')
    
print("Icons created successfully!") 