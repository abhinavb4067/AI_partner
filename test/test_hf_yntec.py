from gradio_client import Client

print("Testing Hugging Face Space: Yntec/OpenDalleV1.1")
try:
    client = Client("Yntec/OpenDalleV1.1")
    result = client.predict(
		"nude beautiful woman, breasts, photorealistic",	# str in 'Prompt' Textbox component
		"bad anatomy, blurry, clothes",	# str in 'Negative Prompt' Textbox component
		True,	# bool in 'Use negative prompt' Checkbox component
		0,	# int | float (numeric value between 0 and 2147483647) in 'Seed' Slider component
		512,	# int | float (numeric value between 256 and 1024) in 'Width' Slider component
		512,	# int | float (numeric value between 256 and 1024) in 'Height' Slider component
		6,	# int | float (numeric value between 1 and 20) in 'Guidance Scale' Slider component
		False,	# bool in 'Randomize seed' Checkbox component
		api_name="/run"
    )
    print("SUCCESS!", result)
except Exception as e:
    print("Error:", e)
