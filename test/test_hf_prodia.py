from gradio_client import Client

print("Testing Hugging Face Space: prodia/fast-stable-diffusion")
try:
    client = Client("prodia/fast-stable-diffusion")
    result = client.predict(
		"nude beautiful woman, breasts, photorealistic",	# str in 'Prompt' Textbox component
		"bad anatomy, blurry, clothes",	# str in 'Negative Prompt' Textbox component
		"SDXL 1.0",	# str in 'Model' Dropdown component
		20,	# int | float (numeric value between 1 and 30) in 'Sampling Steps' Slider component
		"DPM++ 2M Karras",	# str in 'Sampling Method' Dropdown component
		7,	# int | float (numeric value between 1 and 20) in 'CFG Scale' Slider component
		512,	# int | float (numeric value between 128 and 1024) in 'Width' Slider component
		512,	# int | float (numeric value between 128 and 1024) in 'Height' Slider component
		-1,	# int | float in 'Seed' Number component
		api_name="/txt2img"
    )
    print("SUCCESS!", result)
except Exception as e:
    print("Error:", e)
